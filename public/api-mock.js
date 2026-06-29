// api-mock.js —— 本地存储版后端，替换 server.js 的所有 API
(function() {
  const STORAGE_KEY = 'elders_data';

  function readData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function generateId(checkinDate) {
    const dateStr = checkinDate.replace(/-/g, '');
    const data = readData();
    const sameDay = data.filter(e => e.id && e.id.startsWith('E' + dateStr));
    const seq = String(sameDay.length + 1).padStart(3, '0');
    return 'E' + dateStr + seq;
  }

  function calcAge(birthDate, checkinDate) {
    const birth = new Date(birthDate);
    const checkin = new Date(checkinDate);
    let age = checkin.getFullYear() - birth.getFullYear();
    const m = checkin.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && checkin.getDate() < birth.getDate())) age--;
    return age;
  }

  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    const urlStr = typeof url === 'string' ? url : url.url;
    if (!urlStr.startsWith('/api/')) {
      return originalFetch.apply(this, arguments);
    }

    const method = (options.method || 'GET').toUpperCase();
    const path = new URL(urlStr, location.origin).pathname;
    const body = options.body ? JSON.parse(options.body) : {};

    return new Promise((resolve) => {
      let status = 200;
      let responseBody = {};

      try {
        if (path === '/api/elders' && method === 'GET') {
          const params = new URL(urlStr, location.origin).searchParams;
          const keyword = params.get('keyword');
          const statusFilter = params.get('status');
          let data = readData();
          if (keyword) data = data.filter(e => e.name && e.name.includes(keyword));
          if (statusFilter) data = data.filter(e => e.status === statusFilter);
          responseBody = {
            code: 0,
            data: data.map(e => ({
              id: e.id,
              name: e.name,
              ageAtCheckin: e.ageAtCheckin,
              checkinDate: e.checkinDate,
              status: e.status,
            }))
          };
        }
        else if (path === '/api/elders/stats' && method === 'GET') {
          const data = readData();
          responseBody = {
            code: 0,
            data: {
              inHouse: data.filter(e => e.status === '在住').length,
              total: data.length
            }
          };
        }
        else if (path === '/api/elders' && method === 'POST') {
          if (!body.name || !body.birthDate || !body.checkinDate || !body.idCard) {
            status = 400;
            responseBody = { code: -1, message: '必填项缺失' };
          } else {
            const elder = {
              id: generateId(body.checkinDate),
              name: body.name,
              birthDate: body.birthDate,
              ageAtCheckin: calcAge(body.birthDate, body.checkinDate),
              idCard: body.idCard,
              address: body.address || '',
              underlyingDiseases: body.underlyingDiseases || '',
              guardian1: body.guardian1 || {},
              guardian2: body.guardian2 || { name: '', relationship: '', phone: '' },
              remark: body.remark || '',
              checkinDate: body.checkinDate,
              status: '在住'
            };
            const data = readData();
            data.push(elder);
            writeData(data);
            responseBody = { code: 0, data: elder, message: '登记成功' };
          }
        }
        else if (path.startsWith('/api/elders/') && path.endsWith('/checkout') && method === 'PATCH') {
          const id = path.split('/')[3];
          const data = readData();
          const index = data.findIndex(e => e.id === id);
          if (index === -1) {
            status = 404;
            responseBody = { code: -1, message: '未找到该老人记录' };
          } else {
            data[index].status = '已退住';
            writeData(data);
            responseBody = { code: 0, message: '退住办理成功' };
          }
        }
        else if (path.startsWith('/api/elders/') && method === 'GET') {
          const id = path.split('/')[3];
          const data = readData();
          const elder = data.find(e => e.id === id);
          if (!elder) {
            status = 404;
            responseBody = { code: -1, message: '未找到该老人记录' };
          } else {
            responseBody = { code: 0, data: elder };
          }
        }
        else if (path.startsWith('/api/elders/') && method === 'PUT') {
          const id = path.split('/')[3];
          const data = readData();
          const index = data.findIndex(e => e.id === id);
          if (index === -1) {
            status = 404;
            responseBody = { code: -1, message: '未找到该老人记录' };
          } else {
            const updated = {
              ...data[index],
              name: body.name,
              birthDate: body.birthDate,
              ageAtCheckin: calcAge(body.birthDate, body.checkinDate),
              idCard: body.idCard,
              address: body.address || '',
              underlyingDiseases: body.underlyingDiseases || '',
              guardian1: body.guardian1 || {},
              guardian2: body.guardian2 || { name: '', relationship: '', phone: '' },
              remark: body.remark || '',
              checkinDate: body.checkinDate,
            };
            data[index] = updated;
            writeData(data);
            responseBody = { code: 0, data: updated, message: '修改成功' };
          }
        }
        else {
          status = 404;
          responseBody = { code: -1, message: '接口不存在' };
        }
      } catch (err) {
        status = 500;
        responseBody = { code: -1, message: err.message };
      }

      const blob = new Blob([JSON.stringify(responseBody)], { type: 'application/json' });
      const response = new Response(blob, { status });
      resolve(response);
    });
  };
})();