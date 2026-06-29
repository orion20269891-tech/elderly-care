const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'elders.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('读取数据文件失败:', err.message);
    return [];
  }
}

function writeData(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
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
  const monthDiff = checkin.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && checkin.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// 查询老人列表
app.get('/api/elders', (req, res) => {
  try {
    const { keyword, status } = req.query;
    let data = readData();

    if (keyword) {
      data = data.filter(e => e.name && e.name.includes(keyword));
    }
    if (status) {
      data = data.filter(e => e.status === status);
    }

    const result = data.map(e => ({
      id: e.id,
      name: e.name,
      ageAtCheckin: e.ageAtCheckin,
      checkinDate: e.checkinDate,
      status: e.status,
    }));

    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: -1, message: '查询失败: ' + err.message });
  }
});

// 统计信息
app.get('/api/elders/stats', (req, res) => {
  try {
    const data = readData();
    const inHouse = data.filter(e => e.status === '在住').length;
    const total = data.length;
    res.json({ code: 0, data: { inHouse, total } });
  } catch (err) {
    res.status(500).json({ code: -1, message: '统计失败: ' + err.message });
  }
});

// 新增老人
app.post('/api/elders', (req, res) => {
  try {
    const body = req.body;

    if (!body.name || !body.birthDate || !body.checkinDate || !body.idCard) {
      return res.status(400).json({ code: -1, message: '姓名、出生日期、入住日期、身份证号为必填项' });
    }
    if (!body.guardian1 || !body.guardian1.name || !body.guardian1.relationship || !body.guardian1.phone) {
      return res.status(400).json({ code: -1, message: '监护人一姓名、关系、联系方式为必填项' });
    }

    const checkinDate = body.checkinDate;
    const age = calcAge(body.birthDate, checkinDate);

    const elder = {
      id: generateId(checkinDate),
      name: body.name,
      birthDate: body.birthDate,
      ageAtCheckin: age,
      idCard: body.idCard,
      address: body.address || '',
      underlyingDiseases: body.underlyingDiseases || '',
      guardian1: {
        name: body.guardian1.name,
        relationship: body.guardian1.relationship,
        phone: body.guardian1.phone,
      },
      guardian2: body.guardian2 && body.guardian2.name
        ? {
            name: body.guardian2.name,
            relationship: body.guardian2.relationship || '',
            phone: body.guardian2.phone || '',
          }
        : { name: '', relationship: '', phone: '' },
      remark: body.remark || '',
      checkinDate: checkinDate,
      status: '在住',
    };

    const data = readData();
    data.push(elder);
    writeData(data);

    res.json({ code: 0, data: elder, message: '登记成功' });
  } catch (err) {
    res.status(500).json({ code: -1, message: '新增失败: ' + err.message });
  }
});

// 获取单个老人详情
app.get('/api/elders/:id', (req, res) => {
  try {
    const data = readData();
    const elder = data.find(e => e.id === req.params.id);
    if (!elder) {
      return res.status(404).json({ code: -1, message: '未找到该老人记录' });
    }
    res.json({ code: 0, data: elder });
  } catch (err) {
    res.status(500).json({ code: -1, message: '查询失败: ' + err.message });
  }
});

// 修改老人信息
app.put('/api/elders/:id', (req, res) => {
  try {
    const body = req.body;

    if (!body.name || !body.birthDate || !body.checkinDate || !body.idCard) {
      return res.status(400).json({ code: -1, message: '姓名、出生日期、入住日期、身份证号为必填项' });
    }
    if (!body.guardian1 || !body.guardian1.name || !body.guardian1.relationship || !body.guardian1.phone) {
      return res.status(400).json({ code: -1, message: '监护人一姓名、关系、联系方式为必填项' });
    }

    const data = readData();
    const index = data.findIndex(e => e.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ code: -1, message: '未找到该老人记录' });
    }

    const age = calcAge(body.birthDate, body.checkinDate);

    data[index] = {
      ...data[index],
      name: body.name,
      birthDate: body.birthDate,
      ageAtCheckin: age,
      idCard: body.idCard,
      address: body.address || '',
      underlyingDiseases: body.underlyingDiseases || '',
      guardian1: {
        name: body.guardian1.name,
        relationship: body.guardian1.relationship,
        phone: body.guardian1.phone,
      },
      guardian2: body.guardian2 && body.guardian2.name
        ? {
            name: body.guardian2.name,
            relationship: body.guardian2.relationship || '',
            phone: body.guardian2.phone || '',
          }
        : { name: '', relationship: '', phone: '' },
      remark: body.remark || '',
      checkinDate: body.checkinDate,
    };

    writeData(data);
    res.json({ code: 0, data: data[index], message: '修改成功' });
  } catch (err) {
    res.status(500).json({ code: -1, message: '修改失败: ' + err.message });
  }
});

// 办理退住
app.patch('/api/elders/:id/checkout', (req, res) => {
  try {
    const data = readData();
    const index = data.findIndex(e => e.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ code: -1, message: '未找到该老人记录' });
    }

    data[index].status = '已退住';
    writeData(data);
    res.json({ code: 0, message: '退住办理成功' });
  } catch (err) {
    res.status(500).json({ code: -1, message: '退住失败: ' + err.message });
  }
});

// 放在所有 API 路由之后，作为 fallback 处理 SPA 路由
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ code: -1, message: '接口不存在' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`颐馨园养老管理系统已启动: http://localhost:${PORT}`);
});
