function getStudentData() {
  const saved = localStorage.getItem("studentData");
  if (!saved) return null;

  try {
    return JSON.parse(saved);
  } catch (error) {
    return null;
  }
}

function saveStudentData(data) {
  const student = {
    fullName: data.fullName || data.name || data.studentName || "",
    studentId: data.studentId || data.registrationNumber || data.regNo || data.id || "",
    phone: data.phone || data.phoneNumber || data.mobile || "",
    email: data.email || "",
    region: data.region || "",
    subscription: data.subscription || {
      status: "inactive",
      planId: "",
      planName: "",
      price: 0,
      startDate: "",
      expiryDate: "",
      daysRemaining: 0
    },
    isLoggedIn: true
  };

  localStorage.setItem("studentData", JSON.stringify(student));
  return student;
}

function clearStudentData() {
  localStorage.removeItem("studentData");
  localStorage.removeItem("selectedSubscription");
  localStorage.removeItem("pendingPayment");
}

function requireStudentLogin(redirectPage = "login.html") {
  const student = getStudentData();
  if (!student || !student.isLoggedIn) {
    window.location.href = redirectPage;
    return null;
  }
  return student;
}

function logoutStudent(redirectPage = "login.html") {
  clearStudentData();
  window.location.href = redirectPage;
}

function getStudentInitials(name) {
  if (!name) return "S";
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

function fillStudentFields(config = {}) {
  const student = getStudentData();
  if (!student) return null;

  const {
    nameSelector,
    idSelector,
    phoneSelector,
    emailSelector,
    avatarSelector
  } = config;

  if (nameSelector) {
    const el = document.querySelector(nameSelector);
    if (el) el.textContent = student.fullName || "Student";
  }

  if (idSelector) {
    const el = document.querySelector(idSelector);
    if (el) el.textContent = student.studentId || "N/A";
  }

  if (phoneSelector) {
    const el = document.querySelector(phoneSelector);
    if (el) el.textContent = student.phone || "N/A";
  }

  if (emailSelector) {
    const el = document.querySelector(emailSelector);
    if (el) el.textContent = student.email || "N/A";
  }

  if (avatarSelector) {
    const el = document.querySelector(avatarSelector);
    if (el) el.textContent = getStudentInitials(student.fullName);
  }

  return student;
}

async function refreshStudentDataFromServer() {
  const student = getStudentData();
  if (!student || !student.studentId) return null;

  try {
    const response = await fetch(`/api/student/${encodeURIComponent(student.studentId)}`);
    const data = await response.json();

    if (!response.ok) {
      return student;
    }

    if (data.user) {
      saveStudentData(data.user);
      return data.user;
    }

    return student;
  } catch (error) {
    return student;
  }
}