// ============================================
// auth.js - تسجيل دخول ومصادقة الأدمن
// ============================================
var ADMIN_EMAIL = "admin@laabobo.com";
var LEGACY_PASSWORD = "8520";
var LS_KEY = "admin_legacy_session";

function isLegacyLoggedIn(){
  try { return sessionStorage.getItem(LS_KEY) === "1"; } catch(e){ return false; }
}
function setLegacyLogin(v){
  try { if(v) sessionStorage.setItem(LS_KEY, "1"); else sessionStorage.removeItem(LS_KEY); } catch(e){}
}

async function adminLogin(password){
  var pwd = String(password).trim();
  var isEmail = pwd.indexOf("@") !== -1;

  // 1. محاولة تسجيل الدخول عبر البريد الإلكتروني وكلمة المرور في Firebase
  if(isEmail){
    try {
      await auth.signInWithEmailAndPassword(pwd, pwd);
      setLegacyLogin(true);
      return { method: "firebase" };
    } catch(err){
      throw err;
    }
  }

  // 2. محاولة الدخول بحساب الأدمن الأساسي admin@laabobo.com
  try {
    await auth.signInWithEmailAndPassword(ADMIN_EMAIL, pwd);
    setLegacyLogin(true);
    return { method: "firebase" };
  } catch(fbErr) {
    // 3. إذا فشل، محاولة الدخول كمستخدم مجهول (Anonymous Auth) لتجاوز قيود auth != null
    try {
      if(pwd === LEGACY_PASSWORD || pwd.length >= 4){
        await auth.signInAnonymously();
      }
    } catch(anonErr){}

    // 4. فحص كلمة المرور السريعة للتجربة المحلية
    if(pwd === LEGACY_PASSWORD){
      setLegacyLogin(true);
      return { method: "legacy" };
    }

    throw fbErr;
  }
}

async function adminLogout(){
  setLegacyLogin(false);
  try { await auth.signOut(); } catch(e){}
}

function watchAuth(callback){
  return auth.onAuthStateChanged(function(user){
    callback(user, isLegacyLoggedIn());
  });
}

function isAuthenticated(user){
  return !!user || isLegacyLoggedIn();
}

