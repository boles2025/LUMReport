// ============================================
// admin.js - محرك لوحة تحكم المسؤول الشامل والعمليات المتقدمة
// ============================================

var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.from(document.querySelectorAll(s)); };

function show(el){ if(el) el.classList.remove("d-none"); }
function hide(el){ if(el) el.classList.add("d-none"); }

function toast(msg, type){
  type = type || "success";
  var t = document.getElementById("appToast");
  var m = document.getElementById("toastMsg");
  if(!t || !m) return;
  m.textContent = msg;
  t.className = "toast align-items-center border-0 text-bg-" + (type === "error" ? "danger" : type === "warning" ? "warning" : "success") + " show";
  var bs = bootstrap.Toast.getOrCreateInstance(t, { delay: 3500 });
  bs.show();
}

// عناصر واجهة تسجيل الدخول
var loginView = document.getElementById("loginView");
var adminView = document.getElementById("adminView");
var loginForm = document.getElementById("loginForm");
var passwordInput = document.getElementById("passwordInput");
var loginError = document.getElementById("loginError");

function renderAuthState(user){
  var authed = isAuthenticated(user);
  if(authed){
    hide(loginView);
    show(adminView);
    initAdmin();
  } else {
    show(loginView);
    hide(adminView);
  }
}

var toggleBtn = document.getElementById("togglePass");
if(toggleBtn) toggleBtn.addEventListener("click", function(){
  var isText = passwordInput.type === "text";
  passwordInput.type = isText ? "password" : "text";
  document.getElementById("toggleIcon").className = isText ? "bi bi-eye" : "bi bi-eye-slash";
});

if(loginForm) loginForm.addEventListener("submit", async function(e){
  e.preventDefault();
  var pwd = passwordInput.value.trim();
  if(!pwd){
    loginError.textContent = "الرجاء إدخال كلمة المرور أو رمز الدخول.";
    show(loginError);
    return;
  }
  hide(loginError);
  var btn = document.getElementById("loginBtn"), txt = document.getElementById("loginBtnText"), sp = document.getElementById("loginSpinner");
  txt.classList.add("d-none");
  show(sp);
  btn.disabled = true;
  try {
    await adminLogin(pwd);
    renderAuthState(null);
    toast("مرحباً بك! تم تسجيل الدخول بنجاح.");
  } catch(err){
    console.error(err);
    var msg = "كلمة المرور غير صحيحة.";
    if(err.code === "auth/user-not-found") msg = "حساب الأدمن غير موجود في Firebase. يمكنك استخدام الرمز السريع 8520 للتجربة.";
    else if(err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") msg = "كلمة المرور غير صحيحة.";
    else if(err.code === "auth/network-request-failed") msg = "فشل الاتصال بـ Firebase - يمكنك الدخول برمز 8520 محلياً.";
    else if(err.message) msg = err.message;
    loginError.textContent = msg;
    show(loginError);
  } finally {
    txt.classList.remove("d-none");
    hide(sp);
    btn.disabled = false;
  }
});

function doLogout(){
  adminLogout().finally(function(){
    show(loginView);
    hide(adminView);
    toast("تم تسجيل الخروج بنجاح", "warning");
  });
}
var lo1 = document.getElementById("logoutBtn"); if(lo1) lo1.addEventListener("click", doLogout);
var lo2 = document.getElementById("logoutBtn2"); if(lo2) lo2.addEventListener("click", doLogout);

watchAuth(function(user){ renderAuthState(user); });

document.addEventListener("DOMContentLoaded", function(){
  setTimeout(function(){
    var isLegacy = false;
    try{ isLegacy = sessionStorage.getItem("admin_legacy_session") === "1"; }catch(e){}
    if(isLegacy && loginView && !loginView.classList.contains("d-none")){
      if(adminView.classList.contains("d-none")){
        hide(loginView);
        show(adminView);
        initAdmin();
      }
    }
  }, 600);
});

// ============================================
// تهيئة وإدارة لوحة تحكم الأدمن
// ============================================
var adminInitialized = false;
var currentAdminDate = "";

function initAdmin(){
  if(adminInitialized) return;
  adminInitialized = true;
  
  var iso = todayISO();
  currentAdminDate = iso;
  var dateInp = document.getElementById("admGlobalDate");
  if(dateInp) dateInp.value = iso;

  buildDailyForm();
  buildDeptsForm();
  buildWithdrawalForm("admNewForm", "admNewLiveTotal");
  buildWithdrawalForm("admOldForm", "admOldLiveTotal");
  buildOverviewTable();

  loadAllAdminData(iso);
  bindAdminEvents();
  initSidebarNav();
}

function initSidebarNav(){
  var links = $$(".admin-nav .nav-link[data-target]");
  var sections = $$(".adm-section");
  links.forEach(function(btn){
    btn.addEventListener("click", function(){
      var target = btn.getAttribute("data-target");
      links.forEach(function(b){ b.classList.toggle("active", b.getAttribute("data-target") === target); });
      sections.forEach(function(s){ s.classList.toggle("d-none", s.id !== target); });
      var ocEl = document.getElementById("adminOffcanvas");
      var oc = bootstrap.Offcanvas.getInstance(ocEl);
      if(oc) oc.hide();
      
      // تحديث شاشة الملخص إذا تم الانتقال إليها
      if(target === "adm-overview"){
        updateAdminOverview();
      }
    });
  });
}

function sanitizeInt(v){
  var n = parseInt(v, 10);
  if(isNaN(n) || n < 0) return 0;
  return n;
}

// بناء نماذج الإدخال
function buildDailyForm(){
  var c = document.getElementById("admDailyForm");
  if(!c) return;
  c.innerHTML = "";
  colleges.forEach(function(col){
    var row = document.createElement("div");
    row.className = "college-input-row";
    row.innerHTML = 
      '<label class="fw-bold small mb-0" style="color:#1e3a5f;"><i class="bi ' + (col.icon || 'bi-mortarboard') + ' me-2" style="color:' + (col.color || '#2563eb') + '"></i> ' + col.name + '</label>' +
      '<input type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" class="form-control input-number" data-col="' + col.id + '" placeholder="0">';
    c.appendChild(row);
  });
  c.addEventListener("input", function(){
    liveTotal(c, "admDailyLiveTotal");
    updateAdminOverview();
  });
}

function buildDeptsForm(){
  var grid = document.getElementById("admDeptsForm");
  if(!grid) return;
  grid.innerHTML = "";
  departmentsOrder.forEach(function(colId){
    var def = departments[colId];
    var colColor = def.color || '#38bdf8';
    var colDiv = document.createElement("div");
    colDiv.className = "col-md-6 col-lg-6 mb-3";
    var inputsHtml = "";
    def.items.forEach(function(it){
      inputsHtml += '<div class="college-input-row"><label class="small fw-bold mb-0">' + it.name + '</label><input type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" class="form-control input-number" data-col="' + colId + '" data-dept="' + it.id + '" placeholder="0"></div>';
    });
    colDiv.innerHTML = 
      '<div class="dept-card h-100" style="--dept-color:' + colColor + ';">' +
        '<div class="dept-card-header">' +
          '<i class="bi ' + def.icon + '"></i> ' +
          '<span>' + def.label + '</span>' +
        '</div>' +
        '<div class="p-3">' + inputsHtml + '</div>' +
        '<div class="dept-total">' +
          '<span>إجمالي الكلية</span>' +
          '<span class="dept-live-total fw-bold fs-6" data-col-total="' + colId + '" style="color:' + colColor + ';">0</span>' +
        '</div>' +
      '</div>';
    grid.appendChild(colDiv);
  });
  grid.addEventListener("input", function(){
    departmentsOrder.forEach(function(colId){
      var inputs = grid.querySelectorAll('input[data-col="' + colId + '"]');
      var sum = 0;
      inputs.forEach(function(i){ sum += (parseInt(i.value, 10) || 0); });
      var totEl = grid.querySelector('[data-col-total="' + colId + '"]');
      if(totEl) totEl.textContent = formatNumber(sum);
    });
  });
}

function buildWithdrawalForm(containerId, totalId){
  var c = document.getElementById(containerId);
  if(!c) return;
  c.innerHTML = "";
  colleges.forEach(function(col){
    var row = document.createElement("div");
    row.className = "college-input-row";
    row.innerHTML = 
      '<label class="fw-bold small mb-0" style="color:#1e3a5f;"><i class="bi ' + (col.icon || 'bi-mortarboard') + ' me-2" style="color:' + (col.color || '#2563eb') + '"></i> ' + col.name + '</label>' +
      '<input type="number" inputmode="numeric" pattern="[0-9]*" min="0" step="1" class="form-control input-number" data-col="' + col.id + '" placeholder="0">';
    c.appendChild(row);
  });
  c.addEventListener("input", function(){
    liveTotal(c, totalId);
    updateAdminOverview();
  });
}

function buildOverviewTable(){
  var tbody = document.getElementById("admOverviewTableBody");
  if(!tbody) return;
  tbody.innerHTML = "";
  colleges.forEach(function(col){
    var tr = document.createElement("tr");
    tr.innerHTML = 
      '<td class="fw-bold"><i class="bi ' + (col.icon || 'bi-mortarboard') + ' me-2" style="color:' + (col.color || '#2563eb') + '"></i> ' + col.name + '</td>' +
      '<td class="text-center" id="admOvDaily_' + col.id + '">0</td>' +
      '<td class="text-center" id="admOvNew_' + col.id + '">0</td>' +
      '<td class="text-center" id="admOvOld_' + col.id + '">0</td>' +
      '<td class="text-center fw-bold" id="admOvW_' + col.id + '" style="color:#d97706;">0</td>' +
      '<td class="text-center fw-bold" id="admOvNet_' + col.id + '" style="color:#0f9d6a;">0</td>';
    tbody.appendChild(tr);
  });
}

function liveTotal(container, totalElId){
  var totalEl = document.getElementById(totalElId);
  if(!totalEl) return;
  var sum = 0;
  container.querySelectorAll('input[type="number"]').forEach(function(i){ sum += (parseInt(i.value, 10) || 0); });
  totalEl.textContent = formatNumber(sum);
}

// تحديث جدول ولوحة الـ KPIs لملخص الأدمن
function updateAdminOverview(){
  var dForm = document.getElementById("admDailyForm");
  var nForm = document.getElementById("admNewForm");
  var oForm = document.getElementById("admOldForm");

  var totDaily = 0, totNew = 0, totOld = 0;

  colleges.forEach(function(col){
    var dInp = dForm ? dForm.querySelector('input[data-col="' + col.id + '"]') : null;
    var nInp = nForm ? nForm.querySelector('input[data-col="' + col.id + '"]') : null;
    var oInp = oForm ? oForm.querySelector('input[data-col="' + col.id + '"]') : null;

    var dVal = dInp ? (parseInt(dInp.value, 10) || 0) : 0;
    var nVal = nInp ? (parseInt(nInp.value, 10) || 0) : 0;
    var oVal = oInp ? (parseInt(oInp.value, 10) || 0) : 0;

    totDaily += dVal;
    totNew += nVal;
    totOld += oVal;

    var wVal = nVal + oVal;
    var netVal = dVal - wVal;

    var elD = document.getElementById("admOvDaily_" + col.id);
    var elN = document.getElementById("admOvNew_" + col.id);
    var elO = document.getElementById("admOvOld_" + col.id);
    var elW = document.getElementById("admOvW_" + col.id);
    var elNet = document.getElementById("admOvNet_" + col.id);

    if(elD) elD.textContent = formatNumber(dVal);
    if(elN) elN.textContent = formatNumber(nVal);
    if(elO) elO.textContent = formatNumber(oVal);
    if(elW) elW.textContent = formatNumber(wVal);
    if(elNet) elNet.textContent = formatNumber(netVal);
  });

  var totW = totNew + totOld;
  var totNet = totDaily - totW;
  var rate = totDaily > 0 ? ((totW / totDaily) * 100).toFixed(1) : "0.0";

  document.getElementById("admKpiDaily").textContent = formatNumber(totDaily);
  document.getElementById("admKpiNew").textContent = formatNumber(totNew);
  document.getElementById("admKpiOld").textContent = formatNumber(totOld);
  document.getElementById("admKpiNet").textContent = formatNumber(totNet);
  document.getElementById("admKpiRate").textContent = "معدل السحب: " + rate + "%";

  document.getElementById("admTotDaily").textContent = formatNumber(totDaily);
  document.getElementById("admTotNew").textContent = formatNumber(totNew);
  document.getElementById("admTotOld").textContent = formatNumber(totOld);
  document.getElementById("admTotW").textContent = formatNumber(totW);
  document.getElementById("admTotNet").textContent = formatNumber(totNet);
}

// تحميل كافة بيانات التاريخ للأدمن
async function loadAllAdminData(date){
  if(!date) date = todayISO();
  currentAdminDate = date;
  
  var lastUpdatedEl = document.getElementById("admGlobalLastUpdated");
  if(lastUpdatedEl) lastUpdatedEl.innerHTML = '<i class="bi bi-clock"></i> جاري التحميل...';
  
  ["admDaily", "admDepts", "admNew", "admOld"].forEach(function(id){
    show(document.getElementById(id + "Loading"));
  });

  try {
    var full = await fetchFullDateData(date);

    // 1. التقديمات اليومية
    var dForm = document.getElementById("admDailyForm");
    dForm.querySelectorAll("input").forEach(function(i){ i.value = ""; });
    if(full.daily){
      Object.entries(full.daily).forEach(function(kv){
        if(kv[0].startsWith("_") || kv[0] === "updatedAt") return;
        var inp = dForm.querySelector('input[data-col="' + kv[0] + '"]');
        if(inp) inp.value = kv[1];
      });
    }
    liveTotal(dForm, "admDailyLiveTotal");

    // 2. الأقسام الفرعية
    var gDepts = document.getElementById("admDeptsForm");
    gDepts.querySelectorAll("input").forEach(function(i){ i.value = ""; });
    if(full.departments){
      departmentsOrder.forEach(function(colId){
        var colData = full.departments[colId] || {};
        Object.entries(colData).forEach(function(kv){
          var inp = gDepts.querySelector('input[data-col="' + colId + '"][data-dept="' + kv[0] + '"]');
          if(inp) inp.value = kv[1];
        });
      });
    }
    departmentsOrder.forEach(function(colId){
      var inputs = gDepts.querySelectorAll('input[data-col="' + colId + '"]');
      var sum = 0;
      inputs.forEach(function(i){ sum += (parseInt(i.value, 10) || 0); });
      var totEl = gDepts.querySelector('[data-col-total="' + colId + '"]');
      if(totEl) totEl.textContent = formatNumber(sum);
    });

    // 3. سحب الجدد
    var nForm = document.getElementById("admNewForm");
    nForm.querySelectorAll("input").forEach(function(i){ i.value = ""; });
    if(full.newWithdrawal){
      Object.entries(full.newWithdrawal).forEach(function(kv){
        if(kv[0].startsWith("_") || kv[0] === "updatedAt") return;
        var inp = nForm.querySelector('input[data-col="' + kv[0] + '"]');
        if(inp) inp.value = kv[1];
      });
    }
    liveTotal(nForm, "admNewLiveTotal");

    // 4. سحب القدامى
    var oForm = document.getElementById("admOldForm");
    oForm.querySelectorAll("input").forEach(function(i){ i.value = ""; });
    if(full.oldWithdrawal){
      Object.entries(full.oldWithdrawal).forEach(function(kv){
        if(kv[0].startsWith("_") || kv[0] === "updatedAt") return;
        var inp = oForm.querySelector('input[data-col="' + kv[0] + '"]');
        if(inp) inp.value = kv[1];
      });
    }
    liveTotal(oForm, "admOldLiveTotal");

    // تحديث الملخص
    updateAdminOverview();

    var ts = (full.meta && full.meta.updatedAt) || (full.daily && full.daily.updatedAt) || null;
    if(lastUpdatedEl){
      lastUpdatedEl.innerHTML = ts 
        ? '<i class="bi bi-clock-history"></i> آخر حفظ: ' + formatLastUpdated(ts)
        : '<i class="bi bi-calendar3"></i> ' + formatArabicDate(date);
    }

  } catch(err){
    console.error("Admin load error:", err);
    toast("حدث خطأ أثناء تحميل بيانات هذا التاريخ", "error");
  } finally {
    ["admDaily", "admDepts", "admNew", "admOld"].forEach(function(id){
      hide(document.getElementById(id + "Loading"));
    });
  }
}

// دالة جمع بيانات النموذج
function getFormPayload(formElement){
  var payload = {};
  formElement.querySelectorAll("input[data-col]").forEach(function(inp){
    var col = inp.getAttribute("data-col");
    var v = inp.value.trim() === "" ? 0 : sanitizeInt(inp.value);
    payload[col] = v;
  });
  return payload;
}

function getDeptsPayload(){
  var grid = document.getElementById("admDeptsForm");
  var payload = {};
  departmentsOrder.forEach(function(colId){
    payload[colId] = {};
    grid.querySelectorAll('input[data-col="' + colId + '"]').forEach(function(inp){
      var dept = inp.getAttribute("data-dept");
      var v = inp.value.trim() === "" ? 0 : sanitizeInt(inp.value);
      payload[colId][dept] = v;
    });
  });
  return payload;
}

// حفظ قسم التقديمات فقط
async function saveDaily(){
  var date = currentAdminDate;
  var form = document.getElementById("admDailyForm");
  var payload = getFormPayload(form);
  var btn = document.getElementById("saveDailyBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> جاري الحفظ...';
  try {
    var res = await saveSingleSection(DB_PATHS.dailyApplications(date), payload, date, "dailyUpdatedAt", "daily");
    if(res.mode === "firebase"){
      toast("تم حفظ التقديمات اليومية بنجاح في السحابة");
    } else {
      toast("تم الحفظ بنجاح (محلياً) ⚠️ - يرجى تفعيل صلاحيات Firebase للمزامنة السحابية", "warning");
    }
    loadAllAdminData(date);
  } catch(err){
    console.error(err);
    toast("حدث خطأ أثناء حفظ التقديمات: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> حفظ التقديمات اليومية';
  }
}

// حفظ قسم الأقسام الفرعية فقط
async function saveDepts(){
  var date = currentAdminDate;
  var payload = getDeptsPayload();
  var btn = document.getElementById("saveDeptsBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> جاري الحفظ...';
  try {
    var res = await saveSingleSection(DB_PATHS.departments(date), payload, date, "deptsUpdatedAt", "depts");
    if(res.mode === "firebase"){
      toast("تم حفظ بيانات الأقسام بنجاح في السحابة");
    } else {
      toast("تم حفظ بيانات الأقسام (محلياً) ⚠️", "warning");
    }
    loadAllAdminData(date);
  } catch(err){
    console.error(err);
    toast("حدث خطأ أثناء حفظ الأقسام: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> حفظ بيانات الأقسام';
  }
}

// حفظ سحب الجدد فقط
async function saveNew(){
  var date = currentAdminDate;
  var form = document.getElementById("admNewForm");
  var payload = getFormPayload(form);
  var btn = document.getElementById("saveNewBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> جاري الحفظ...';
  try {
    var res = await saveSingleSection(DB_PATHS.newWithdrawal(date), payload, date, "newUpdatedAt", "new");
    if(res.mode === "firebase"){
      toast("تم حفظ انسحاب الطلاب الجدد بنجاح في السحابة");
    } else {
      toast("تم حفظ انسحاب الجدد (محلياً) ⚠️", "warning");
    }
    loadAllAdminData(date);
  } catch(err){
    console.error(err);
    toast("حدث خطأ أثناء حفظ انسحاب الجدد: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> حفظ انسحاب الجدد';
  }
}

// حفظ انسحاب القدامى فقط
async function saveOld(){
  var date = currentAdminDate;
  var form = document.getElementById("admOldForm");
  var payload = getFormPayload(form);
  var btn = document.getElementById("saveOldBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> جاري الحفظ...';
  try {
    var res = await saveSingleSection(DB_PATHS.oldWithdrawal(date), payload, date, "oldUpdatedAt", "old");
    if(res.mode === "firebase"){
      toast("تم حفظ انسحاب الطلاب القدامى بنجاح في السحابة");
    } else {
      toast("تم حفظ انسحاب القدامى (محلياً) ⚠️", "warning");
    }
    loadAllAdminData(date);
  } catch(err){
    console.error(err);
    toast("حدث خطأ أثناء حفظ انسحاب القدامى: " + (err.message || err), "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> حفظ انسحاب القدامى';
  }
}

// حفظ كافة الأقسام معاً في عملية واحدة
async function saveAllSections(){
  var date = currentAdminDate;
  if(!date){ toast("الرجاء اختيار تاريخ صحيح", "warning"); return; }

  var dailyPayload = getFormPayload(document.getElementById("admDailyForm"));
  var deptsPayload = getDeptsPayload();
  var newPayload = getFormPayload(document.getElementById("admNewForm"));
  var oldPayload = getFormPayload(document.getElementById("admOldForm"));

  var btn = document.getElementById("admBtnSaveAll");
  var qBtn = document.getElementById("admQuickSaveBtn");
  if(btn){ btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> جاري حفظ الكل...'; }
  if(qBtn){ qBtn.disabled = true; qBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> حفظ...'; }

  try {
    var res = await saveAllDateData(date, {
      daily: dailyPayload,
      departments: deptsPayload,
      newWithdrawal: newPayload,
      oldWithdrawal: oldPayload
    });
    if(res.mode === "firebase"){
      toast("🎉 تم حفظ وتحديث كافة الأقسام بنجاح في السحابة!");
    } else {
      toast("تم حفظ كافة الأقسام (محلياً) ⚠️ - يرجى التأكد من صلاحيات Firebase لمزامنتها سحابياً", "warning");
    }
    loadAllAdminData(date);
  } catch(err){
    console.error("Save all error:", err);
    toast("حدث خطأ أثناء حفظ كافة الأقسام: " + (err.message || err), "error");
  } finally {
    if(btn){ btn.disabled = false; btn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill"></i> حفظ كل الأقسام'; }
    if(qBtn){ qBtn.disabled = false; qBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i> حفظ الإحصائيات'; }
  }
}

// نسخ بيانات من تاريخ سابق
async function handleCopyFromDate(){
  var srcDate = document.getElementById("copySourceDate").value;
  if(!srcDate){ toast("الرجاء تحديد التاريخ المصدر للنسخ", "warning"); return; }
  
  var modalEl = document.getElementById("copyModal");
  var modal = bootstrap.Modal.getInstance(modalEl);
  if(modal) modal.hide();

  toast("جاري استيراد أرقام يوم " + srcDate + "...");
  try {
    var full = await fetchFullDateData(srcDate);
    
    // تعبئة النماذج
    var dForm = document.getElementById("admDailyForm");
    if(full.daily){
      Object.entries(full.daily).forEach(function(kv){
        if(kv[0].startsWith("_") || kv[0] === "updatedAt") return;
        var inp = dForm.querySelector('input[data-col="' + kv[0] + '"]');
        if(inp) inp.value = kv[1];
      });
      liveTotal(dForm, "admDailyLiveTotal");
    }

    var gDepts = document.getElementById("admDeptsForm");
    if(full.departments){
      departmentsOrder.forEach(function(colId){
        var colData = full.departments[colId] || {};
        Object.entries(colData).forEach(function(kv){
          var inp = gDepts.querySelector('input[data-col="' + colId + '"][data-dept="' + kv[0] + '"]');
          if(inp) inp.value = kv[1];
        });
      });
      departmentsOrder.forEach(function(colId){
        var inputs = gDepts.querySelectorAll('input[data-col="' + colId + '"]');
        var sum = 0;
        inputs.forEach(function(i){ sum += (parseInt(i.value, 10) || 0); });
        var totEl = gDepts.querySelector('[data-col-total="' + colId + '"]');
        if(totEl) totEl.textContent = formatNumber(sum);
      });
    }

    var nForm = document.getElementById("admNewForm");
    if(full.newWithdrawal){
      Object.entries(full.newWithdrawal).forEach(function(kv){
        if(kv[0].startsWith("_") || kv[0] === "updatedAt") return;
        var inp = nForm.querySelector('input[data-col="' + kv[0] + '"]');
        if(inp) inp.value = kv[1];
      });
      liveTotal(nForm, "admNewLiveTotal");
    }

    var oForm = document.getElementById("admOldForm");
    if(full.oldWithdrawal){
      Object.entries(full.oldWithdrawal).forEach(function(kv){
        if(kv[0].startsWith("_") || kv[0] === "updatedAt") return;
        var inp = oForm.querySelector('input[data-col="' + kv[0] + '"]');
        if(inp) inp.value = kv[1];
      });
      liveTotal(oForm, "admOldLiveTotal");
    }

    updateAdminOverview();
    toast("تم نسخ بيانات " + srcDate + " بنجاح! يمكنك الآن تعديل الفروقات وحفظها.");
  } catch(err){
    console.error(err);
    toast("تعذر استيراد بيانات التاريخ المحدد", "error");
  }
}

// تصفير حقول نموذج
function zeroForm(container, totalId){
  container.querySelectorAll('input[type="number"]').forEach(function(i){ i.value = "0"; });
  if(totalId) liveTotal(container, totalId);
  updateAdminOverview();
  toast("تم تصفير الحقول", "warning");
}

// تصفير جميع الحقول
function zeroAllForms(){
  var dForm = document.getElementById("admDailyForm");
  var gDepts = document.getElementById("admDeptsForm");
  var nForm = document.getElementById("admNewForm");
  var oForm = document.getElementById("admOldForm");

  if(dForm) zeroForm(dForm, "admDailyLiveTotal");
  if(gDepts){
    gDepts.querySelectorAll("input").forEach(function(i){ i.value = "0"; });
    departmentsOrder.forEach(function(cId){
      var tot = gDepts.querySelector('[data-col-total="' + cId + '"]');
      if(tot) tot.textContent = "0";
    });
  }
  if(nForm) zeroForm(nForm, "admNewLiveTotal");
  if(oForm) zeroForm(oForm, "admOldLiveTotal");

  updateAdminOverview();
  toast("تم تصفير كافة الحقول للشاشة الحالية", "warning");
}

// حذف بيانات التاريخ الحالي
async function handleDeleteDate(){
  var date = currentAdminDate;
  var modalEl = document.getElementById("deleteModal");
  var modal = bootstrap.Modal.getInstance(modalEl);
  if(modal) modal.hide();

  try {
    await deleteDateData(date);
    toast("تم حذف بيانات يوم " + date + " بنجاح من قاعدة البيانات", "warning");
    loadAllAdminData(date);
  } catch(err){
    console.error(err);
    toast("تعذر حذف البيانات", "error");
  }
}

// تصدير نسخة احتياطية كاملة JSON
async function handleExportBackup(){
  try {
    toast("جاري إعداد النسخة الاحتياطية...");
    var backup = await exportFullDatabase();
    var fname = "University_Full_Backup_" + todayISO() + ".json";
    downloadJSON(fname, backup);
    toast("تم تنزيل ملف النسخة الاحتياطية بنجاح");
  } catch(err){
    console.error(err);
    toast("تعذر تصدير النسخة الاحتياطية", "error");
  }
}

// استعادة نسخة احتياطية JSON
async function handleImportBackup(){
  var fileInput = document.getElementById("importBackupFile");
  if(!fileInput || !fileInput.files || fileInput.files.length === 0){
    toast("الرجاء اختيار ملف النسخة الاحتياطية (.json)", "warning");
    return;
  }
  var file = fileInput.files[0];
  var reader = new FileReader();
  reader.onload = async function(e){
    try {
      var json = JSON.parse(e.target.result);
      if(!confirm("تحذير: استعادة النسخة الاحتياطية ستستبدل البيانات الحالية في النظام. هل تريد المتابعة بالتأكيد؟")) return;
      toast("جاري استعادة البيانات...");
      await importFullDatabase(json);
      toast("🎉 تمت استعادة النسخة الاحتياطية بنجاح!");
      loadAllAdminData(currentAdminDate);
      fileInput.value = "";
    } catch(err){
      console.error(err);
      toast("ملف النسخة الاحتياطية غير صالح أو حدث خطأ أثناء الاستعادة", "error");
    }
  };
  reader.readAsText(file);
}

// تصدير بيانات الأدمن إلى Excel
function exportAdminDailyCSV(){
  var date = currentAdminDate || todayISO();
  var dForm = document.getElementById("admDailyForm");
  var nForm = document.getElementById("admNewForm");
  var oForm = document.getElementById("admOldForm");

  var rows = [
    ["تقرير إحصائيات لوحة تحكم المسؤول", "التاريخ: " + date],
    ["تاريخ الاستخراج", new Date().toLocaleString('ar-EG')],
    [],
    ["الكلية", "المتقدمين الجدد", "انسحاب جدد", "انسحاب قدامى", "إجمالي الانسحاب", "الصافي الفعلي"]
  ];

  var totD = 0, totN = 0, totO = 0;
  colleges.forEach(function(c){
    var dInp = dForm ? dForm.querySelector('input[data-col="' + c.id + '"]') : null;
    var nInp = nForm ? nForm.querySelector('input[data-col="' + c.id + '"]') : null;
    var oInp = oForm ? oForm.querySelector('input[data-col="' + c.id + '"]') : null;

    var d = dInp ? (parseInt(dInp.value, 10) || 0) : 0;
    var n = nInp ? (parseInt(nInp.value, 10) || 0) : 0;
    var o = oInp ? (parseInt(oInp.value, 10) || 0) : 0;
    var w = n + o;

    totD += d; totN += n; totO += o;
    rows.push([c.name, d, n, o, w, d - w]);
  });

  var totW = totN + totO;
  rows.push([]);
  rows.push(["الإجمالي العام", totD, totN, totO, totW, totD - totW]);

  downloadCSV("Admin_Statistics_" + date + ".csv", rows);
}

// ربط جميع أحداث الأدمن
function bindAdminEvents(){
  var dateInp = document.getElementById("admGlobalDate");
  if(dateInp){
    dateInp.addEventListener("change", function(e){
      if(e.target.value) loadAllAdminData(e.target.value);
    });
  }

  var btnToday = document.getElementById("admBtnToday");
  if(btnToday) btnToday.addEventListener("click", function(){
    var t = todayISO();
    if(dateInp) dateInp.value = t;
    loadAllAdminData(t);
  });

  var btnYesterday = document.getElementById("admBtnYesterday");
  if(btnYesterday) btnYesterday.addEventListener("click", function(){
    var y = getYesterdayISO(dateInp ? dateInp.value : todayISO());
    if(dateInp) dateInp.value = y;
    loadAllAdminData(y);
  });

  var btnSaveAll = document.getElementById("admBtnSaveAll");
  if(btnSaveAll) btnSaveAll.addEventListener("click", saveAllSections);

  var btnQuickSave = document.getElementById("admQuickSaveBtn");
  if(btnQuickSave) btnQuickSave.addEventListener("click", saveAllSections);

  var s1 = document.getElementById("saveDailyBtn"); if(s1) s1.addEventListener("click", saveDaily);
  var s2 = document.getElementById("saveDeptsBtn"); if(s2) s2.addEventListener("click", saveDepts);
  var s3 = document.getElementById("saveNewBtn"); if(s3) s3.addEventListener("click", saveNew);
  var s4 = document.getElementById("saveOldBtn"); if(s4) s4.addEventListener("click", saveOld);

  var r1 = document.getElementById("reloadDailyBtn"); if(r1) r1.addEventListener("click", function(){ loadAllAdminData(currentAdminDate); });
  var r2 = document.getElementById("reloadDeptsBtn"); if(r2) r2.addEventListener("click", function(){ loadAllAdminData(currentAdminDate); });
  var r3 = document.getElementById("reloadNewBtn"); if(r3) r3.addEventListener("click", function(){ loadAllAdminData(currentAdminDate); });
  var r4 = document.getElementById("reloadOldBtn"); if(r4) r4.addEventListener("click", function(){ loadAllAdminData(currentAdminDate); });

  var z1 = document.getElementById("zeroDailyBtn"); if(z1) z1.addEventListener("click", function(){ zeroForm(document.getElementById("admDailyForm"), "admDailyLiveTotal"); });
  var z2 = document.getElementById("zeroDeptsBtn"); if(z2) z2.addEventListener("click", function(){
    var g = document.getElementById("admDeptsForm");
    g.querySelectorAll("input").forEach(function(i){ i.value = "0"; });
    departmentsOrder.forEach(function(cId){ var t = g.querySelector('[data-col-total="' + cId + '"]'); if(t) t.textContent = "0"; });
  });
  var z3 = document.getElementById("zeroNewBtn"); if(z3) z3.addEventListener("click", function(){ zeroForm(document.getElementById("admNewForm"), "admNewLiveTotal"); });
  var z4 = document.getElementById("zeroOldBtn"); if(z4) z4.addEventListener("click", function(){ zeroForm(document.getElementById("admOldForm"), "admOldLiveTotal"); });

  var zAll = document.getElementById("btnZeroAllCurrent"); if(zAll) zAll.addEventListener("click", zeroAllForms);

  var btnCopyModal = document.getElementById("admBtnCopyPrevModal");
  if(btnCopyModal) btnCopyModal.addEventListener("click", function(){
    var cInp = document.getElementById("copySourceDate");
    if(cInp) cInp.value = getYesterdayISO(currentAdminDate);
  });
  var btnConfCopy = document.getElementById("btnConfirmCopy");
  if(btnConfCopy) btnConfCopy.addEventListener("click", handleCopyFromDate);

  var btnDelModal = document.getElementById("btnDeleteDateModal");
  if(btnDelModal) btnDelModal.addEventListener("click", function(){
    var dSpan = document.getElementById("deleteDateTarget");
    if(dSpan) dSpan.textContent = currentAdminDate;
  });
  var btnConfDel = document.getElementById("btnConfirmDelete");
  if(btnConfDel) btnConfDel.addEventListener("click", handleDeleteDate);

  var btnExpBackup = document.getElementById("btnExportBackup");
  if(btnExpBackup) btnExpBackup.addEventListener("click", handleExportBackup);

  var btnImpBackup = document.getElementById("btnImportBackup");
  if(btnImpBackup) btnImpBackup.addEventListener("click", handleImportBackup);

  var btnExpExcel = document.getElementById("admExportExcelBtn");
  if(btnExpExcel) btnExpExcel.addEventListener("click", exportAdminDailyCSV);

  document.querySelectorAll(".theme-toggle-btn").forEach(function(b){
    b.addEventListener("click", toggleTheme);
  });

  // تحسين تجربة إدخال الأرقام بالكيبورد
  document.addEventListener("keydown", function(e){
    if(e.key === "Enter" && e.target.matches('input[type="number"]')){
      e.preventDefault();
      var inputs = $$('input[type="number"]:not([disabled])').filter(function(i){ return i.offsetParent !== null; });
      var idx = inputs.indexOf(e.target);
      if(idx > -1 && idx < inputs.length - 1){
        inputs[idx + 1].focus();
        inputs[idx + 1].select();
      }
    }
  });

  document.addEventListener("focusin", function(e){
    if(e.target.matches('input[type="number"]')){
      e.target.select();
    }
  });

  document.addEventListener("input", function(e){
    if(e.target.matches('input[type="number"]')){
      if(Number(e.target.value) < 0) e.target.value = 0;
    }
  });
}
