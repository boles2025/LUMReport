// ============================================
// data.js - المصدر المركزي للبيانات والعمليات الحسابية
// ============================================

var colleges = [
  { id: "dentistry",             name: "طب الأسنان",                 icon: "bi-heart-pulse-fill", color: "#0ea5e9" },
  { id: "physiotherapy",         name: "العلاج الطبيعي",             icon: "bi-activity",         color: "#2563eb" },
  { id: "pharmacy",              name: "الصيدلة",                    icon: "bi-capsule",          color: "#8b5cf6" },
  { id: "engineering",           name: "الهندسة",                    icon: "bi-cpu",              color: "#f59e0b" },
  { id: "computers",             name: "الحاسبات والمعلومات",        icon: "bi-laptop",           color: "#0f9d6a" },
  { id: "nursing",               name: "التمريض",                    icon: "bi-bandaid",          color: "#ec4899" },
  { id: "healthSciences",        name: "تكنولوجيا العلوم الصحية",   icon: "bi-hospital",         color: "#06b6d4" },
  { id: "managementEconomics",   name: "الإدارة والاقتصاد",          icon: "bi-briefcase",        color: "#10b981" }
];

var departments = {
  healthSciences: {
    label: "تكنولوجيا العلوم الصحية",
    icon: "bi-hospital",
    color: "#06b6d4",
    items: [
      { id: "medicalLabs",      name: "تكنولوجيا المختبرات الطبية" },
      { id: "dentalTechnology",  name: "تكنولوجيا صناعة وتركيب الأسنان" },
      { id: "radiology",         name: "تكنولوجيا علوم الأشعة والتصوير الطبي" },
      { id: "biomedicalDevices", name: "تكنولوجيا الأجهزة الطبية الحيوية" }
    ]
  },
  engineering: {
    label: "الهندسة",
    icon: "bi-cpu",
    color: "#f59e0b",
    items: [
      { id: "mechatronics",          name: "هندسة الميكاترونيات والمنظومات الذكية" },
      { id: "electronicsAI",         name: "هندسة الإلكترونيات والذكاء الاصطناعي" },
      { id: "biomedicalEngineering", name: "الهندسة الطبية الحيوية" },
      { id: "energySustainability",  name: "هندسة الطاقة والاستدامة" },
      { id: "structuralSustainability", name: "الهندسة الإنشائية والاستدامة" },
      { id: "architectureSmart",     name: "هندسة التصميم المعماري والعمارة الذكية" }
    ]
  },
  pharmacy: {
    label: "الصيدلة",
    icon: "bi-capsule",
    color: "#a855f7",
    items: [
      { id: "pharmD",   name: "فارم دي" },
      { id: "clinical", name: "إكلينيك" }
    ]
  },
  managementEconomics: {
    label: "الإدارة والاقتصاد",
    icon: "bi-briefcase",
    color: "#10b981",
    items: [
      { id: "arabic",  name: "عربي" },
      { id: "english", name: "إنجليزي" }
    ]
  }
};

var departmentsOrder = ["healthSciences", "engineering", "pharmacy", "managementEconomics"];

// دوال مساعدة للتواريخ
function todayISO(){
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  var day = String(d.getDate()).padStart(2,'0');
  return y + "-" + m + "-" + day;
}

function getYesterdayISO(isoDate){
  var d = isoDate ? new Date(isoDate + "T00:00:00") : new Date();
  d.setDate(d.getDate() - 1);
  var y = d.getFullYear();
  var m = String(d.getMonth()+1).padStart(2,'0');
  var day = String(d.getDate()).padStart(2,'0');
  return y + "-" + m + "-" + day;
}

function formatArabicDate(iso){
  if(!iso) return "";
  try{
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }catch(e){ return iso; }
}

function formatLastUpdated(ts){
  if(!ts) return "";
  var d = new Date(ts);
  var now = new Date();
  var isToday = d.toDateString() === now.toDateString();
  var timeStr = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if(isToday){
    return timeStr;
  }
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' }) + " - " + timeStr;
}

function formatNumber(num){
  if(num == null || isNaN(num)) return "0";
  return Number(num).toLocaleString('ar-EG');
}

function emptyDailyApplications(){
  var o = {};
  colleges.forEach(function(c){ o[c.id] = 0; });
  return o;
}

function emptyWithdrawal(){
  var o = {};
  colleges.forEach(function(c){ o[c.id] = 0; });
  return o;
}

function emptyDepartments(){
  var o = {};
  departmentsOrder.forEach(function(colId){
    o[colId] = {};
    departments[colId].items.forEach(function(it){
      o[colId][it.id] = 0;
    });
  });
  return o;
}

// دالة تصدير بيانات كـ CSV عربي متوافق تماماً مع Microsoft Excel
function downloadCSV(filename, csvRows){
  var bom = "\uFEFF";
  var csvContent = bom + csvRows.map(function(row){
    return row.map(function(item){
      var str = String(item == null ? "" : item);
      if(str.indexOf(",") !== -1 || str.indexOf('"') !== -1 || str.indexOf("\n") !== -1){
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(",");
  }).join("\r\n");

  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// دالة تصدير كائن كـ JSON
function downloadJSON(filename, obj){
  var jsonStr = JSON.stringify(obj, null, 2);
  var blob = new Blob([jsonStr], { type: "application/json" });
  var link = document.createElement("a");
  var url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================
// إدارة الوضع الداكن الهادئ (Calm Dark Mode)
// ============================================
function initTheme(){
  var saved = "dark";
  try {
    saved = localStorage.getItem("univ_theme") || "dark";
  } catch(e){}
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcon(saved);
}

function toggleTheme(){
  var current = document.documentElement.getAttribute("data-theme") || "dark";
  var next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("univ_theme", next);
  } catch(e){}
  updateThemeIcon(next);
}

function updateThemeIcon(theme){
  var btns = document.querySelectorAll(".theme-toggle-btn");
  btns.forEach(function(btn){
    if(theme === "dark"){
      btn.innerHTML = '<i class="bi bi-sun-fill text-warning"></i> <span class="d-none d-sm-inline">الوضع الفاتح</span>';
      btn.title = "التبديل إلى الوضع الفاتح";
    } else {
      btn.innerHTML = '<i class="bi bi-moon-stars-fill text-info"></i> <span class="d-none d-sm-inline">الوضع الداكن</span>';
      btn.title = "التبديل إلى الوضع الداكن الهادئ";
    }
  });
}

// تفعيل السمة تلقائياً بمجرد تحميل السكربت
initTheme();

