// ============================================
// firebase.js - إعدادات Firebase والعمليات المركزية لقاعدة البيانات (سحابي + محلي هجين)
// ============================================
var firebaseConfig = {
  apiKey: "AIzaSyB-hH9u1c--jRz9FLsNFzMIb6Xlc96GE",
  authDomain: "laabobo.firebaseapp.com",
  databaseURL: "https://laabobo-default-rtdb.firebaseio.com",
  projectId: "laabobo",
  storageBucket: "laabobo.firebasestorage.app",
  messagingSenderId: "239915159957",
  appId: "1:239915159957:web:55910817e5e26abb77a69c"
};

try { firebase.initializeApp(firebaseConfig); } catch(e) {}

var db = firebase.database();
var auth = firebase.auth();

var DB_PATHS = {
  root:              function(){ return "statistics"; },
  dailyApplications: function(date){ return "statistics/dailyApplications/" + date; },
  departments:       function(date){ return "statistics/departments/" + date; },
  newWithdrawal:     function(date){ return "statistics/newStudentsWithdrawal/" + date; },
  oldWithdrawal:     function(date){ return "statistics/oldStudentsWithdrawal/" + date; },
  altDaily:          function(date){ return "dailyApplications/" + date; },
  altDepts:          function(date){ return "departments/" + date; },
  altNew:            function(date){ return "newStudentsWithdrawal/" + date; },
  altOld:            function(date){ return "oldStudentsWithdrawal/" + date; },
  meta:              function(date){ return "statistics/meta/" + date; }
};

// دوال التخزين المحلي الاحتياطي
var LOCAL_PREFIX = "univ_stats_";

function saveLocalKey(key, data){
  try {
    localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(data));
  } catch(e){}
}

function getLocalKey(key){
  try {
    var item = localStorage.getItem(LOCAL_PREFIX + key);
    return item ? JSON.parse(item) : null;
  } catch(e){
    return null;
  }
}

function deleteLocalKey(key){
  try {
    localStorage.removeItem(LOCAL_PREFIX + key);
  } catch(e){}
}

function withTimeout(promise, ms){
  return new Promise(function(resolve){
    var timer = setTimeout(function(){
      resolve(null);
    }, ms || 1800);
    promise.then(function(res){
      clearTimeout(timer);
      resolve(res);
    }).catch(function(){
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function fetchWithFallback(primaryPath, altPath, localKey){
  try {
    var snap = await withTimeout(db.ref(primaryPath).once('value'), 1800);
    if(snap && snap.exists() && snap.val() !== null){
      var v = snap.val();
      if(localKey) saveLocalKey(localKey, v);
      return v;
    }
    if(altPath){
      snap = await withTimeout(db.ref(altPath).once('value'), 1200);
      if(snap && snap.exists() && snap.val() !== null){
        var v2 = snap.val();
        if(localKey) saveLocalKey(localKey, v2);
        return v2;
      }
    }
  } catch(e) {
    console.warn("Firebase fetch notice for " + primaryPath + ":", e.message || e);
  }

  // استخدام النسخة المحلية عند تعذر الاتصال بالسحابة أو انتهاء المهلة
  if(localKey){
    var localData = getLocalKey(localKey);
    if(localData) return localData;
  }
  return null;
}

// جلب كامل بيانات يوم محدد في طلب واحد متزامن
async function fetchFullDateData(date){
  var results = await Promise.all([
    fetchWithFallback(DB_PATHS.dailyApplications(date), DB_PATHS.altDaily(date), date + "_daily"),
    fetchWithFallback(DB_PATHS.departments(date), DB_PATHS.altDepts(date), date + "_depts"),
    fetchWithFallback(DB_PATHS.newWithdrawal(date), DB_PATHS.altNew(date), date + "_new"),
    fetchWithFallback(DB_PATHS.oldWithdrawal(date), DB_PATHS.altOld(date), date + "_old"),
    fetchWithFallback(DB_PATHS.meta(date), null, date + "_meta")
  ]);

  return {
    daily: results[0] || null,
    departments: results[1] || null,
    newWithdrawal: results[2] || null,
    oldWithdrawal: results[3] || null,
    meta: results[4] || null
  };
}

// حفظ قسم واحد
async function saveSingleSection(path, data, date, metaKey, localKey){
  var now = Date.now();
  data.updatedAt = now;
  
  // 1. الحفظ المحلي المباشر أولاً
  if(localKey) saveLocalKey(date + "_" + localKey, data);
  
  var metaObj = getLocalKey(date + "_meta") || {};
  metaObj[metaKey] = now;
  metaObj.updatedAt = now;
  saveLocalKey(date + "_meta", metaObj);

  // 2. محاولة الحفظ في Firebase Realtime Database
  var fbError = null;
  try {
    await db.ref(path).set(data);
    var metaUpdate = { updatedAt: now };
    metaUpdate[metaKey] = now;
    await db.ref(DB_PATHS.meta(date)).update(metaUpdate);
    return { success: true, mode: "firebase", timestamp: now };
  } catch(err){
    console.warn("Firebase write error at " + path + ":", err);
    fbError = err;
    return { success: true, mode: "local", error: fbError, timestamp: now };
  }
}

// حفظ كافة أقسام اليوم في عملية واحدة
async function saveAllDateData(date, payload){
  var now = Date.now();
  var updates = {};

  // 1. الحفظ المحلي فوراً لكافة الأقسام
  if(payload.daily){
    payload.daily.updatedAt = now;
    saveLocalKey(date + "_daily", payload.daily);
    updates[DB_PATHS.dailyApplications(date)] = payload.daily;
  }
  if(payload.departments){
    payload.departments.updatedAt = now;
    saveLocalKey(date + "_depts", payload.departments);
    updates[DB_PATHS.departments(date)] = payload.departments;
  }
  if(payload.newWithdrawal){
    payload.newWithdrawal.updatedAt = now;
    saveLocalKey(date + "_new", payload.newWithdrawal);
    updates[DB_PATHS.newWithdrawal(date)] = payload.newWithdrawal;
  }
  if(payload.oldWithdrawal){
    payload.oldWithdrawal.updatedAt = now;
    saveLocalKey(date + "_old", payload.oldWithdrawal);
    updates[DB_PATHS.oldWithdrawal(date)] = payload.oldWithdrawal;
  }

  var metaObj = {
    updatedAt: now,
    dailyUpdatedAt: payload.daily ? now : (payload.existingMeta?.dailyUpdatedAt || now),
    deptsUpdatedAt: payload.departments ? now : (payload.existingMeta?.deptsUpdatedAt || now),
    newUpdatedAt: payload.newWithdrawal ? now : (payload.existingMeta?.newUpdatedAt || now),
    oldUpdatedAt: payload.oldWithdrawal ? now : (payload.existingMeta?.oldUpdatedAt || now)
  };
  saveLocalKey(date + "_meta", metaObj);
  updates[DB_PATHS.meta(date)] = metaObj;

  // 2. محاولة الحفظ في Firebase
  try {
    await db.ref().update(updates);
    return { success: true, mode: "firebase", timestamp: now };
  } catch(err){
    console.warn("Firebase batch update notice:", err);
    return { success: true, mode: "local", error: err, timestamp: now };
  }
}

// حذف بيانات تاريخ محدد بالكامل
async function deleteDateData(date){
  deleteLocalKey(date + "_daily");
  deleteLocalKey(date + "_depts");
  deleteLocalKey(date + "_new");
  deleteLocalKey(date + "_old");
  deleteLocalKey(date + "_meta");

  var updates = {};
  updates[DB_PATHS.dailyApplications(date)] = null;
  updates[DB_PATHS.departments(date)] = null;
  updates[DB_PATHS.newWithdrawal(date)] = null;
  updates[DB_PATHS.oldWithdrawal(date)] = null;
  updates[DB_PATHS.meta(date)] = null;
  updates[DB_PATHS.altDaily(date)] = null;
  updates[DB_PATHS.altDepts(date)] = null;
  updates[DB_PATHS.altNew(date)] = null;
  updates[DB_PATHS.altOld(date)] = null;

  try {
    await db.ref().update(updates);
  } catch(e){}
}

// تصدير قاعدة البيانات كاملة للنسخ الاحتياطي
async function exportFullDatabase(){
  var stats = {};
  try {
    var snap = await db.ref("statistics").once('value');
    if(snap.exists()) stats = snap.val();
  } catch(e){}

  // دمج المفاتيح المحلية أيضاً لضمان نسخ كل شيء
  try {
    for(var i = 0; i < localStorage.length; i++){
      var k = localStorage.key(i);
      if(k && k.startsWith(LOCAL_PREFIX)){
        var cleanKey = k.replace(LOCAL_PREFIX, "");
        stats["local_" + cleanKey] = getLocalKey(cleanKey);
      }
    }
  } catch(e){}

  return {
    exportedAt: new Date().toISOString(),
    version: "2.0",
    statistics: stats
  };
}

// استعادة قاعدة البيانات من ملف نسخة احتياطية
async function importFullDatabase(backupData){
  if(!backupData) throw new Error("ملف النسخة الاحتياطية فارغ أو غير صالح.");
  var dataToSet = backupData.statistics || backupData;
  
  // استعادة محلياً أيضاً
  try {
    Object.entries(dataToSet).forEach(function(kv){
      if(kv[0].startsWith("local_")){
        saveLocalKey(kv[0].replace("local_", ""), kv[1]);
      }
    });
  } catch(e){}

  try {
    await db.ref("statistics").set(dataToSet);
  } catch(e){
    console.warn("Firebase cloud restore notice:", e);
  }
}


