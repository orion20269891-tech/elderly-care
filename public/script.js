// 公共工具函数
function showToast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast toast-' + (type === 'error' ? 'error' : 'success');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 2500);
}

function getQuery(name) {
  var params = new URLSearchParams(window.location.search);
  return params.get(name);
}

// ============================
// 首页逻辑 (index.html)
// ============================
function initIndexPage() {
  var confirmId = null;
  var searchTimer = null;

  var keywordInput = document.getElementById('keywordInput');
  var searchBtn = document.getElementById('searchBtn');
  var showCheckout = document.getElementById('showCheckout');
  var addBtn = document.getElementById('addBtn');
  var tableBody = document.getElementById('tableBody');
  var emptyTip = document.getElementById('emptyTip');
  var confirmModal = document.getElementById('confirmModal');
  var confirmName = document.getElementById('confirmName');
  var modalCancel = document.getElementById('modalCancel');
  var modalConfirm = document.getElementById('modalConfirm');
  var statInHouse = document.getElementById('statInHouse');
  var statTotal = document.getElementById('statTotal');

  function loadStats() {
    fetch('/api/elders/stats')
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.code === 0) {
          statInHouse.textContent = res.data.inHouse;
          statTotal.textContent = res.data.total;
        }
      })
      .catch(function (err) { console.error(err); });
  }

  function loadList(keyword, status) {
    var params = [];
    if (keyword) params.push('keyword=' + encodeURIComponent(keyword));
    if (status) params.push('status=' + encodeURIComponent(status));
    var url = '/api/elders' + (params.length ? '?' + params.join('&') : '');

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.code !== 0) { showToast(res.message, 'error'); return; }
        renderTable(res.data);
        loadStats();
      })
      .catch(function (err) { showToast('请求失败', 'error'); });
  }

  function renderTable(list) {
    tableBody.innerHTML = '';
    if (!list || list.length === 0) {
      emptyTip.style.display = 'block';
      return;
    }
    emptyTip.style.display = 'none';

    list.forEach(function (elder) {
      var tr = document.createElement('tr');
      var statusClass = elder.status === '在住' ? 'status-in' : 'status-out';
      var actionHtml = '';
      if (elder.status === '在住') {
        actionHtml =
          '<button class="btn btn-edit" data-id="' + elder.id + '">修改信息</button>' +
          '<button class="btn btn-checkout" data-id="' + elder.id + '">办理退住</button>';
      } else {
        actionHtml = '<span style="color:#999;">已退住</span>';
      }

      tr.innerHTML =
        '<td>' + elder.id + '</td>' +
        '<td>' + elder.name + '</td>' +
        '<td>' + elder.ageAtCheckin + ' 岁</td>' +
        '<td>' + elder.checkinDate + '</td>' +
        '<td><span class="status-badge ' + statusClass + '">' + elder.status + '</span></td>' +
        '<td class="action-cell">' + actionHtml + '</td>';

      tableBody.appendChild(tr);
    });

    // 绑定事件
    tableBody.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        window.location.href = 'form.html?mode=edit&id=' + btn.getAttribute('data-id');
      });
    });

    tableBody.querySelectorAll('.btn-checkout').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var row = btn.closest('tr');
        var name = row ? row.cells[1].textContent : '';
        confirmId = id;
        confirmName.textContent = name;
        confirmModal.style.display = 'flex';
      });
    });
  }

  function doSearch() {
    var keyword = keywordInput.value.trim();
    var status = showCheckout.checked ? '' : '在住';
    loadList(keyword, status);
  }

  searchBtn.addEventListener('click', doSearch);

  keywordInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 300);
  });

  showCheckout.addEventListener('change', doSearch);

  addBtn.addEventListener('click', function () {
    window.location.href = 'form.html?mode=add';
  });

  modalCancel.addEventListener('click', function () {
    confirmModal.style.display = 'none';
    confirmId = null;
  });

  modalConfirm.addEventListener('click', function () {
    if (!confirmId) return;
    fetch('/api/elders/' + confirmId + '/checkout', { method: 'PATCH' })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        confirmModal.style.display = 'none';
        if (res.code === 0) {
          showToast('退住办理成功', 'success');
          doSearch();
        } else {
          showToast(res.message, 'error');
        }
        confirmId = null;
      })
      .catch(function () { showToast('请求失败', 'error'); confirmModal.style.display = 'none'; });
  });

  // 点击遮罩关闭
  confirmModal.addEventListener('click', function (e) {
    if (e.target === confirmModal) { confirmModal.style.display = 'none'; confirmId = null; }
  });

  // 初始加载
  loadList('', '在住');
}

// ============================
// 登记/修改页逻辑 (form.html)
// ============================
function initFormPage() {
  var mode = getQuery('mode');
  var elderId = getQuery('id');

  document.getElementById('mode').value = mode;
  document.getElementById('elderId').value = elderId || '';

  var formTitle = document.getElementById('formTitle');
  var submitBtn = document.getElementById('submitBtn');
  var backBtn = document.getElementById('backBtn');
  var cancelBtn = document.getElementById('cancelBtn');
  var form = document.getElementById('elderForm');

  if (mode === 'edit') {
    formTitle.textContent = '修改老人信息';
    submitBtn.textContent = '保存修改';
  }

  backBtn.addEventListener('click', function () { window.location.href = 'index.html'; });
  cancelBtn.addEventListener('click', function () { window.location.href = 'index.html'; });

  // 自动计算入住年龄
  var birthDateInput = document.getElementById('birthDate');
  var checkinDateInput = document.getElementById('checkinDate');
  var ageInput = document.getElementById('ageAtCheckin');

  function calcAgeDisplay() {
    var birth = birthDateInput.value;
    var checkin = checkinDateInput.value;
    if (birth && checkin) {
      var b = new Date(birth);
      var c = new Date(checkin);
      var age = c.getFullYear() - b.getFullYear();
      var m = c.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && c.getDate() < b.getDate())) { age--; }
      ageInput.value = age >= 0 ? age + ' 岁' : '';
    } else {
      ageInput.value = '';
    }
  }

  birthDateInput.addEventListener('change', calcAgeDisplay);
  checkinDateInput.addEventListener('change', calcAgeDisplay);

  // 编辑模式：加载数据回填
  if (mode === 'edit' && elderId) {
    fetch('/api/elders/' + elderId)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.code !== 0) { showToast(res.message, 'error'); return; }
        var e = res.data;
        document.getElementById('name').value = e.name || '';
        document.getElementById('idCard').value = e.idCard || '';
        document.getElementById('birthDate').value = e.birthDate || '';
        document.getElementById('checkinDate').value = e.checkinDate || '';
        ageInput.value = e.ageAtCheckin != null ? e.ageAtCheckin + ' 岁' : '';
        document.getElementById('address').value = e.address || '';
        document.getElementById('underlyingDiseases').value = e.underlyingDiseases || '';
        document.getElementById('g1name').value = e.guardian1 ? e.guardian1.name : '';
        document.getElementById('g1relationship').value = e.guardian1 ? e.guardian1.relationship : '';
        document.getElementById('g1phone').value = e.guardian1 ? e.guardian1.phone : '';
        document.getElementById('g2name').value = e.guardian2 ? e.guardian2.name : '';
        document.getElementById('g2relationship').value = e.guardian2 ? e.guardian2.relationship : '';
        document.getElementById('g2phone').value = e.guardian2 ? e.guardian2.phone : '';
        document.getElementById('remark').value = e.remark || '';
      })
      .catch(function () { showToast('加载数据失败', 'error'); });
  } else {
    // 添加模式：入住日期默认今天
    var today = new Date().toISOString().slice(0, 10);
    document.getElementById('checkinDate').value = today;
  }

  // 表单提交
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var body = {
      name: document.getElementById('name').value.trim(),
      idCard: document.getElementById('idCard').value.trim(),
      birthDate: document.getElementById('birthDate').value,
      checkinDate: document.getElementById('checkinDate').value,
      address: document.getElementById('address').value.trim(),
      underlyingDiseases: document.getElementById('underlyingDiseases').value.trim(),
      guardian1: {
        name: document.getElementById('g1name').value.trim(),
        relationship: document.getElementById('g1relationship').value.trim(),
        phone: document.getElementById('g1phone').value.trim(),
      },
      guardian2: {
        name: document.getElementById('g2name').value.trim(),
        relationship: document.getElementById('g2relationship').value.trim(),
        phone: document.getElementById('g2phone').value.trim(),
      },
      remark: document.getElementById('remark').value.trim(),
    };

    // 基础校验
    if (!body.name || !body.idCard || !body.birthDate || !body.checkinDate) {
      showToast('请填写所有必填基本信息', 'error'); return;
    }
    if (!body.guardian1.name || !body.guardian1.relationship || !body.guardian1.phone) {
      showToast('请填写监护人一的完整信息', 'error'); return;
    }

    var url = mode === 'edit' ? '/api/elders/' + elderId : '/api/elders';
    var method = mode === 'edit' ? 'PUT' : 'POST';

    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.code === 0) {
          showToast(res.message || '操作成功', 'success');
          setTimeout(function () { window.location.href = 'index.html'; }, 800);
        } else {
          showToast(res.message, 'error');
        }
      })
      .catch(function () { showToast('请求失败，请检查网络', 'error'); });
  });
}

// 页面入口判断
(function () {
  if (document.getElementById('elderTable')) {
    initIndexPage();
  } else if (document.getElementById('elderForm')) {
    initFormPage();
  }
})();
