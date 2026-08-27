// ============================================
// app.js - محرك لوحة تحكم المستخدم والإحصائيات الحية
// ============================================

var $ = function(s){ return document.querySelector(s); };
var $$ = function(s){ return Array.from(document.querySelectorAll(s)); };

function show(el){ if(el) el.classList.remove("d-none"); }
function hide(el){ if(el) el.classList.add("d-none"); }

var dailyChart = null;
var newChart = null;
var oldChart = null;

function destroyChart(c){ try{ if(c) c.destroy(); }catch(e){} }

var palette = ["#1e3a5f","#2563eb","#0ea5e9","#0f9d6a","#f59e0b","#ef4444","#8b5cf6","#ec4899"];

function barOptions(title){
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: {
        display: !!title,
        text: title || "",
        font: { family: "Cairo", weight: "bold", size: 14 },
        color: "#ffffff",
        padding: { bottom: 14 }
      },
      tooltip: {
        rtl: true,
        titleFont: { family: "Cairo", weight: "bold", size: 13 },
        bodyFont: { family: "Cairo", weight: "bold", size: 12 }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: "#ffffff",
          font: { family: "Cairo", weight: "bold", size: 12 }
        },
        grid: { color: "rgba(255, 255, 255, 0.12)" }
      },
      x: {
        ticks: {
          color: "#ffffff",
          font: { family: "Cairo", weight: "bold", size: 11.5 },
          maxRotation: 30
        },
        grid: { display: false }
      }
    }
  };
}

function doughnutOptions(){
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom", rtl: true, labels: { font: { family: "Cairo", size: 11 }, padding: 14, usePointStyle: true } },
      tooltip: { rtl: true, titleFont: { family: "Cairo" }, bodyFont: { family: "Cairo" } }
    }
  };
}

function initHeaderDate(){
  var iso = todayISO();
  var el = document.querySelector("#headerDate span");
  if(el) el.textContent = formatArabicDate(iso);
}

// الكاش اللحظي لبيانات التاريخ النشط
var currentDataCache = {
  date: "",
  daily: null,
  departments: null,
  newWithdrawal: null,
  oldWithdrawal: null,
  meta: null
};

// تحميل كافة بيانات التاريخ المختار وتحديث جميع التبويبات في آن واحد
async function loadAllDashboardData(date){
  if(!date) date = todayISO();
  currentDataCache.date = date;

  var lastUpdatedEl = document.getElementById("globalLastUpdated");
  if(lastUpdatedEl) lastUpdatedEl.innerHTML = '<i class="bi bi-clock"></i> جاري التحميل...';
  
  // إظهار مؤشر التحميل في التبويبات
  ["overview", "daily", "depts", "new", "old"].forEach(function(sec){
    show(document.getElementById(sec + "Loading"));
    hide(document.getElementById(sec + "Error"));
  });

  try {
    var full = await fetchFullDateData(date);
    currentDataCache.daily = full.daily;
    currentDataCache.departments = full.departments;
    currentDataCache.newWithdrawal = full.newWithdrawal;
    currentDataCache.oldWithdrawal = full.oldWithdrawal;
    currentDataCache.meta = full.meta;

    var ts = (full.meta && full.meta.updatedAt) || (full.daily && full.daily.updatedAt) || null;
    if(lastUpdatedEl){
      lastUpdatedEl.innerHTML = ts 
        ? '<i class="bi bi-clock-history"></i> آخر تحديث: ' + formatLastUpdated(ts)
        : '<i class="bi bi-calendar3"></i> ' + formatArabicDate(date);
    }

    var sub = document.getElementById("printSubtitle");
    if(sub) sub.textContent = "تقرير إحصائيات يوم: " + formatArabicDate(date);

    renderOverview();
    renderDailyTab();
    renderDeptsTab();
    renderWithdrawalTab("new");
    renderWithdrawalTab("old");

  } catch(err) {
    console.error("Dashboard loading error:", err);
    ["overview", "daily", "depts", "new", "old"].forEach(function(sec){
      show(document.getElementById(sec + "Error"));
    });
    if(lastUpdatedEl) lastUpdatedEl.innerHTML = '<i class="bi bi-exclamation-triangle text-danger"></i> تعذر التحميل';
  } finally {
    ["overview", "daily", "depts", "new", "old"].forEach(function(sec){
      hide(document.getElementById(sec + "Loading"));
    });
  }
}

// 1. عرض جدول الملخص العام Overview (التقديم وسحب الملفات فقط)
function renderOverview(){
  var daily = currentDataCache.daily || {};
  var newW = currentDataCache.newWithdrawal || {};
  var oldW = currentDataCache.oldWithdrawal || {};

  var totDaily = 0, totNew = 0, totOld = 0;
  var tableBody = document.getElementById("overviewTableBody");
  if(!tableBody) return;
  tableBody.innerHTML = "";

  colleges.forEach(function(c){
    var dVal = Number(daily[c.id] || 0);
    var nVal = Number(newW[c.id] || 0);
    var oVal = Number(oldW[c.id] || 0);

    totDaily += dVal;
    totNew += nVal;
    totOld += oVal;

    var tr = document.createElement("tr");
    tr.innerHTML = 
      '<td class="fw-bold col-college"><i class="bi ' + (c.icon || 'bi-mortarboard') + ' me-1 college-icon" style="color:' + (c.color || '#2563eb') + '"></i><span class="col-title">' + c.name + '</span></td>' +
      '<td class="text-center col-stat-app"><span class="badge-count primary">' + formatNumber(dVal) + '</span></td>' +
      '<td class="text-center col-stat-new"><span class="badge-count warning">' + formatNumber(nVal) + '</span></td>' +
      '<td class="text-center col-stat-old"><span class="badge-count danger">' + formatNumber(oVal) + '</span></td>';
    tableBody.appendChild(tr);
  });

  // تحديث خانات الإجمالي في أسفل الجدول
  var elTotDaily = document.getElementById("ovTotDaily");
  var elTotNew = document.getElementById("ovTotNew");
  var elTotOld = document.getElementById("ovTotOld");

  if(elTotDaily) elTotDaily.textContent = formatNumber(totDaily);
  if(elTotNew) elTotNew.textContent = formatNumber(totNew);
  if(elTotOld) elTotOld.textContent = formatNumber(totOld);
}

// 2. عرض التقديمات اليومية
function renderDailyTab(){
  var data = currentDataCache.daily;
  var emptyEl = document.getElementById("dailyEmpty");
  var contentEl = document.getElementById("dailyContent");
  if(!data || Object.keys(data).length === 0){
    show(emptyEl); hide(contentEl); return;
  }
  hide(emptyEl); show(contentEl);

  var tbody = document.getElementById("dailyTableBody");
  tbody.innerHTML = "";
  var total = 0;
  var labels = [], vals = [];

  colleges.forEach(function(c){
    var v = Number(data[c.id] != null ? data[c.id] : 0);
    total += v;
    labels.push(c.name);
    vals.push(v);
  });

  colleges.forEach(function(c){
    var v = Number(data[c.id] != null ? data[c.id] : 0);
    var tr = document.createElement("tr");
    tr.innerHTML = 
      '<td class="fw-bold fs-6"><i class="bi ' + (c.icon || 'bi-mortarboard') + ' me-2" style="color:' + (c.color || '#2563eb') + '"></i> ' + c.name + '</td>' +
      '<td class="text-center"><span class="badge-count primary fs-6 px-3 py-1">' + formatNumber(v) + '</span></td>';
    tbody.appendChild(tr);
  });

  document.getElementById("dailyTotal").textContent = formatNumber(total);
  document.getElementById("dailyTableTotal").textContent = formatNumber(total);

  destroyChart(dailyChart);
  var ctx = document.getElementById("dailyChart");
  if(ctx){
    dailyChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          data: vals,
          backgroundColor: palette.map(function(c){ return c + "CC"; }),
          borderColor: palette,
          borderWidth: 1.2,
          borderRadius: 8,
          barThickness: 18
        }]
      },
      options: barOptions("عدد المتقدمين حسب الكلية")
    });
  }
}

// 3. عرض الكليات والأقسام
function renderDeptsTab(){
  var data = currentDataCache.departments;
  var emptyEl = document.getElementById("deptsEmpty");
  var contentEl = document.getElementById("deptsContent");
  if(!data || Object.keys(data).length === 0){
    show(emptyEl); hide(contentEl); return;
  }
  hide(emptyEl); show(contentEl);

  var grid = document.getElementById("deptsGrid");
  grid.innerHTML = "";
  var allLabels = [], allVals = [], allColors = [];
  var colorIdx = 0;

  departmentsOrder.forEach(function(colId){
    var colDef = departments[colId];
    var colColor = colDef.color || '#38bdf8';
    var colData = data[colId] || {};
    var colTotal = 0;
    var card = document.createElement("div");
    card.className = "col-md-6 col-xl-3";
    var rowsHtml = "";

    colDef.items.forEach(function(it){
      var v = Number(colData[it.id] != null ? colData[it.id] : 0);
      colTotal += v;
      rowsHtml += '<div class="dept-row"><span>' + it.name + '</span><span class="badge-count primary">' + formatNumber(v) + '</span></div>';
    });

    card.innerHTML = 
      '<div class="dept-card h-100" style="--dept-color:' + colColor + ';">' +
        '<div class="dept-card-header">' +
          '<i class="bi ' + colDef.icon + '"></i> ' +
          '<span>' + colDef.label + '</span>' +
        '</div>' +
        '<div>' + rowsHtml + '</div>' +
        '<div class="dept-total">' +
          '<span>إجمالي الكلية</span>' +
          '<span class="fw-bold fs-6" style="color:' + colColor + ';">' + formatNumber(colTotal) + '</span>' +
        '</div>' +
      '</div>';
    grid.appendChild(card);
  });
}

// 4. عرض سحب الطلاب (جدد / قدامى)
function renderWithdrawalTab(kind){
  var isNew = kind === "new";
  var data = isNew ? currentDataCache.newWithdrawal : currentDataCache.oldWithdrawal;
  var emptyEl = document.getElementById(isNew ? "newEmpty" : "oldEmpty");
  var contentEl = document.getElementById(isNew ? "newContent" : "oldContent");
  
  if(!data || Object.keys(data).length === 0){
    show(emptyEl); hide(contentEl); return;
  }
  hide(emptyEl); show(contentEl);

  var tbody = document.getElementById(isNew ? "newTableBody" : "oldTableBody");
  var totalEl = document.getElementById(isNew ? "newTotal" : "oldTotal");
  var tableTotalEl = document.getElementById(isNew ? "newTableTotal" : "oldTableTotal");
  var chartEl = document.getElementById(isNew ? "newChart" : "oldChart");

  tbody.innerHTML = "";
  var total = 0;
  var labels = [], vals = [];

  colleges.forEach(function(c){
    var v = Number(data[c.id] != null ? data[c.id] : 0);
    total += v;
    labels.push(c.name);
    vals.push(v);
  });

  colleges.forEach(function(c){
    var v = Number(data[c.id] != null ? data[c.id] : 0);
    var pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0.0";
    var tr = document.createElement("tr");
    tr.innerHTML = 
      '<td><i class="bi ' + (c.icon || 'bi-mortarboard') + ' me-2" style="color:' + (c.color || '#2563eb') + '"></i> ' + c.name + '</td>' +
      '<td class="text-center"><span class="badge-count ' + (isNew ? "warning" : "danger") + '">' + formatNumber(v) + '</span></td>' +
      '<td class="text-center"><div class="mini-progress"><div class="mini-progress-bar" style="width:' + pct + '%;background:' + (isNew ? "#f59e0b" : "#ef4444") + ';"></div></div> <span class="small fw-bold">' + pct + '%</span></td>';
    tbody.appendChild(tr);
  });

  totalEl.textContent = formatNumber(total);
  tableTotalEl.textContent = formatNumber(total);

  if(isNew) destroyChart(newChart); else destroyChart(oldChart);
  var chartInst = new Chart(chartEl, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        data: vals,
        backgroundColor: isNew ? "#f59e0bCC" : "#ef4444CC",
        borderColor: isNew ? "#d97706" : "#dc2626",
        borderWidth: 1.2,
        borderRadius: 8,
        barThickness: 18
      }]
    },
    options: barOptions(isNew ? "انسحاب جدد" : "انسحاب قدامى")
  });
  if(isNew) newChart = chartInst; else oldChart = chartInst;
}

// تصدير جدول المقارنة الشامل إلى CSV
function exportMasterTableCSV(){
  var date = currentDataCache.date || todayISO();
  var daily = currentDataCache.daily || {};
  var newW = currentDataCache.newWithdrawal || {};
  var oldW = currentDataCache.oldWithdrawal || {};

  var rows = [
    ["تقرير إحصائيات الكليات (التقديم وسحب الملفات)", "التاريخ: " + date],
    ["تاريخ الاستخراج", new Date().toLocaleString('ar-EG')],
    [],
    ["الكلية", "المتقدمين الجدد", "انسحاب جدد", "انسحاب قدامى"]
  ];

  var totDaily = 0, totNew = 0, totOld = 0;
  colleges.forEach(function(c){
    var dVal = Number(daily[c.id] || 0);
    var nVal = Number(newW[c.id] || 0);
    var oVal = Number(oldW[c.id] || 0);
    totDaily += dVal;
    totNew += nVal;
    totOld += oVal;
    rows.push([c.name, dVal, nVal, oVal]);
  });

  rows.push([]);
  rows.push(["الإجمالي العام", totDaily, totNew, totOld]);

  downloadCSV("University_Summary_Report_" + date + ".csv", rows);
}

// تصدير كافة بيانات اليوم إلى Excel CSV
function exportFullDailyCSV(){
  var date = currentDataCache.date || todayISO();
  var daily = currentDataCache.daily || {};
  var depts = currentDataCache.departments || {};
  var newW = currentDataCache.newWithdrawal || {};
  var oldW = currentDataCache.oldWithdrawal || {};

  var rows = [
    ["التقرير الإحصائي الشامل للجامعة", "تاريخ الإحصائية: " + date],
    ["تاريخ التصدير", new Date().toLocaleString('ar-EG')],
    [],
    ["=== 1. التقديمات والانسحابات والصافي ==="],
    ["الكلية", "المتقدمين الجدد", "انسحاب جدد", "انسحاب قدامى", "إجمالي الانسحاب", "الصافي"],
  ];

  colleges.forEach(function(c){
    var dVal = Number(daily[c.id] || 0);
    var nVal = Number(newW[c.id] || 0);
    var oVal = Number(oldW[c.id] || 0);
    var wVal = nVal + oVal;
    rows.push([c.name, dVal, nVal, oVal, wVal, dVal - wVal]);
  });

  rows.push([]);
  rows.push(["=== 2. تفاصيل الأقسام الفرعية ==="]);
  rows.push(["الكلية", "القسم الفرعي", "العدد"]);
  departmentsOrder.forEach(function(colId){
    var colDef = departments[colId];
    var colData = depts[colId] || {};
    colDef.items.forEach(function(it){
      rows.push([colDef.label, it.name, Number(colData[it.id] || 0)]);
    });
  });

  downloadCSV("University_Full_Statistics_" + date + ".csv", rows);
}

// تفعيل الاستماع اللحظي (Realtime Listener)
var activeListenerRef = null;
function setupRealtimeListener(date){
  try {
    if(activeListenerRef) activeListenerRef.off();
    activeListenerRef = db.ref("statistics/meta/" + date);
    activeListenerRef.on('value', function(snapshot){
      if(snapshot.exists()){
        loadAllDashboardData(date);
      }
    });
  } catch(e) {
    console.warn("Realtime listener notice:", e);
  }
}

// تهيئة الأحداث وشريط التاريخ الموحد
function initEvents(){
  var dateInp = document.getElementById("globalDate");
  var iso = todayISO();
  if(dateInp){
    dateInp.value = iso;
    dateInp.max = "2099-12-31";
    dateInp.addEventListener("change", function(e){
      var d = e.target.value;
      if(d){
        loadAllDashboardData(d);
        setupRealtimeListener(d);
      }
    });
  }

  var btnToday = document.getElementById("btnDateToday");
  if(btnToday) btnToday.addEventListener("click", function(){
    if(dateInp){
      var t = todayISO();
      dateInp.value = t;
      loadAllDashboardData(t);
      setupRealtimeListener(t);
    }
  });

  var btnYesterday = document.getElementById("btnDateYesterday");
  if(btnYesterday) btnYesterday.addEventListener("click", function(){
    if(dateInp){
      var y = getYesterdayISO(dateInp.value);
      dateInp.value = y;
      loadAllDashboardData(y);
      setupRealtimeListener(y);
    }
  });

  var btnRefresh = document.getElementById("btnRefreshData");
  if(btnRefresh) btnRefresh.addEventListener("click", function(){
    var d = dateInp ? dateInp.value : todayISO();
    loadAllDashboardData(d);
  });

  function preparePrintHeader(){
    var activeTabEl = document.querySelector(".nav-tabs .nav-link.active");
    var targetId = activeTabEl ? activeTabEl.getAttribute("data-bs-target") : "#tab-overview";
    
    var title = "جدول إحصائيات الكليات (التقديم وسحب الملفات)";
    if(targetId === "#tab-daily") title = "تقرير التقديمات اليومية حسب الكلية";
    else if(targetId === "#tab-depts") title = "تقرير إحصائيات الكليات والأقسام الفرعية";
    else if(targetId === "#tab-new") title = "تقرير إحصائيات انسحاب جدد";
    else if(targetId === "#tab-old") title = "تقرير إحصائيات انسحاب قدامى";

    var statNameEl = document.getElementById("printStatName");
    if(statNameEl) statNameEl.textContent = title;

    var dateStr = currentDataCache.date || todayISO();
    var printDateEl = document.querySelector("#printDate span");
    if(printDateEl) printDateEl.textContent = formatArabicDate(dateStr) + " (" + dateStr + ")";

    var printGenEl = document.querySelector("#printGeneratedAt span");
    if(printGenEl) printGenEl.textContent = new Date().toLocaleString('ar-EG');
  }

  window.addEventListener("beforeprint", function(){
    preparePrintHeader();
    document.documentElement.setAttribute("data-theme", "light");
  });

  window.addEventListener("afterprint", function(){
    var savedTheme = localStorage.getItem("univ_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  });

  var printBtn = document.getElementById("printReportBtn");
  if(printBtn) printBtn.addEventListener("click", function(){
    preparePrintHeader();
    var currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    document.documentElement.setAttribute("data-theme", "light");
    window.print();
    setTimeout(function(){
      document.documentElement.setAttribute("data-theme", currentTheme);
    }, 400);
  });

  var expMaster = document.getElementById("exportMasterTableBtn");
  if(expMaster) expMaster.addEventListener("click", exportMasterTableCSV);

  var expGlobal = document.getElementById("exportGlobalExcelBtn");
  if(expGlobal) expGlobal.addEventListener("click", exportFullDailyCSV);

  var themeBtn = document.getElementById("themeToggleBtn");
  if(themeBtn) themeBtn.addEventListener("click", toggleTheme);

  // إعادة ضبط الرسوم البيانية عند تبديل التبويبات
  document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(function(btn){
    btn.addEventListener("shown.bs.tab", function(){
      setTimeout(function(){
        [dailyChart, newChart, oldChart].forEach(function(c){
          try{ if(c) c.resize(); }catch(e){}
        });
      }, 120);
    });
  });
}

document.addEventListener("DOMContentLoaded", function(){
  initHeaderDate();
  initEvents();
  var iso = todayISO();
  loadAllDashboardData(iso);
  setupRealtimeListener(iso);
});
