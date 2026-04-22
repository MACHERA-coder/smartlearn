const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

/* ======================================================
   TEMP DATABASE
====================================================== */

let students = [
  {
    id: 1,
    studentId: "KLM2026001",
    name: "STEPHANO MACHERA",
    phone: "0710409894",
    region: "Kilimanjaro",
    email: "macherastephano@gmail.com",
    password: "12345",
    status: "active",
    packageName: "Basic Plan",
    packageCode: "basic",
    subscriptionStatus: "active",
    paymentStatus: "paid",
    amountPaid: 5000,
    paymentMethod: "M-Pesa",
    examAccessStatus: "allowed",
    registeredDate: "2026-04-21"
  },
  {
    id: 2,
    studentId: "ARS2026002",
    name: "JOHN STUDENT",
    phone: "0711223344",
    region: "Arusha",
    email: "john@student.com",
    password: "12345",
    status: "active",
    packageName: "",
    packageCode: "",
    subscriptionStatus: "inactive",
    paymentStatus: "pending",
    amountPaid: 0,
    paymentMethod: "",
    examAccessStatus: "blocked",
    registeredDate: "2026-04-21"
  }
];

let packages = [
  {
    id: 1,
    code: "basic",
    name: "Basic Plan",
    price: 5000,
    period: "Monthly",
    description: "Basic monthly access",
    status: "active",
    createdDate: "2026-04-21"
  },
  {
    id: 2,
    code: "standard",
    name: "Standard Plan",
    price: 10000,
    period: "Monthly",
    description: "Standard monthly access",
    status: "active",
    createdDate: "2026-04-21"
  },
  {
    id: 3,
    code: "premium",
    name: "Premium Plan",
    price: 15000,
    period: "Monthly",
    description: "Premium monthly access",
    status: "active",
    createdDate: "2026-04-21"
  }
];

let payments = [
  {
    id: 1,
    paymentId: "PAY-001",
    studentId: "KLM2026001",
    studentName: "STEPHANO MACHERA",
    email: "macherastephano@gmail.com",
    packageName: "Basic Plan",
    packageCode: "basic",
    amount: 5000,
    period: "Monthly",
    method: "M-Pesa",
    status: "paid",
    date: "2026-04-21"
  }
];

let exams = [
  {
    id: 1,
    title: "Biology Mock Exam",
    url: "https://example.com/exam-link",
    groupName: "Form Four",
    status: "active",
    dateAdded: "2026-04-21"
  }
];

/* ======================================================
   HELPERS
====================================================== */

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function generateStudentId(region) {
  const regionMap = {
    kilimanjaro: "KLM",
    arusha: "ARS",
    "dar es salaam": "DSM",
    dar: "DSM",
    dodoma: "DDM",
    mwanza: "MWZ",
    mbeya: "MBY",
    morogoro: "MRG",
    tanga: "TNG"
  };

  const prefix = regionMap[normalizeText(region).toLowerCase()] || "STD";
  const nextNumber = String(students.length + 1).padStart(3, "0");
  return `${prefix}2026${nextNumber}`;
}

function findStudentByEmail(email) {
  const actualEmail = normalizeEmail(email);
  return students.find((student) => normalizeEmail(student.email) === actualEmail);
}

function findStudentByStudentId(studentId) {
  const actualStudentId = normalizeText(studentId);
  return students.find((student) => student.studentId === actualStudentId);
}

function findPackageByCode(code) {
  const actualCode = normalizeText(code).toLowerCase();
  return packages.find((pkg) => normalizeText(pkg.code).toLowerCase() === actualCode);
}

function findActiveExam() {
  return exams.find((exam) => normalizeText(exam.status).toLowerCase() === "active");
}

function publicStudent(student) {
  return {
    id: student.id,
    studentId: student.studentId,
    name: student.name,
    phone: student.phone,
    region: student.region,
    email: student.email,
    status: student.status,
    packageName: student.packageName,
    packageCode: student.packageCode,
    subscriptionStatus: student.subscriptionStatus,
    paymentStatus: student.paymentStatus,
    amountPaid: student.amountPaid || 0,
    paymentMethod: student.paymentMethod || "",
    examAccessStatus: student.examAccessStatus || "blocked",
    registeredDate: student.registeredDate || ""
  };
}

function countStudentsUsingPackage(packageName) {
  return students.filter((student) => normalizeText(student.packageName) === normalizeText(packageName)).length;
}

function updateStudentAccess(student) {
  const isActiveSub = normalizeText(student.subscriptionStatus).toLowerCase() === "active";
  const isPaid = normalizeText(student.paymentStatus).toLowerCase() === "paid";
  student.examAccessStatus = isActiveSub && isPaid ? "allowed" : "blocked";
}

/* ======================================================
   PAGE ROUTES
====================================================== */

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/student-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "student-dashboard.html"));
});

app.get("/admin-dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin-dashboard.html"));
});

/* ======================================================
   AUTH ROUTES
====================================================== */

app.post("/login", (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = normalizeText(req.body.password);

  if (email === "admin@smartlearn.com" && password === "12345") {
    return res.json({
      success: true,
      role: "admin",
      redirect: "/admin-dashboard",
      message: "Admin login successful"
    });
  }

  const student = students.find(
    (item) => normalizeEmail(item.email) === email && normalizeText(item.password) === password
  );

  if (!student) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });
  }

  return res.json({
    success: true,
    role: "student",
    redirect: "/student-dashboard",
    message: "Student login successful",
    student: {
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      subscriptionStatus: student.subscriptionStatus,
      packageName: student.packageName
    }
  });
});

/* ======================================================
   REGISTER ROUTES
====================================================== */

app.post("/register", (req, res) => {
  const name = normalizeText(req.body.name || req.body.fullName);
  const phone = normalizeText(req.body.phone);
  const region = normalizeText(req.body.region);
  const email = normalizeEmail(req.body.email);
  const password = normalizeText(req.body.password);

  if (!name || !phone || !region || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Full name, phone number, region, email, and password are required."
    });
  }

  if (findStudentByEmail(email)) {
    return res.status(409).json({
      success: false,
      message: "This email is already registered."
    });
  }

  const newStudent = {
    id: students.length + 1,
    studentId: generateStudentId(region),
    name,
    phone,
    region,
    email,
    password,
    status: "active",
    packageName: "",
    packageCode: "",
    subscriptionStatus: "inactive",
    paymentStatus: "pending",
    amountPaid: 0,
    paymentMethod: "",
    examAccessStatus: "blocked",
    registeredDate: new Date().toISOString().slice(0, 10)
  };

  students.push(newStudent);

  return res.json({
    success: true,
    message: "Registration successful.",
    redirect: "/login",
    studentId: newStudent.studentId
  });
});

/* ======================================================
   STUDENT PROFILE / PACKAGES
====================================================== */

app.get("/api/student/profile/:studentId", (req, res) => {
  const student = findStudentByStudentId(req.params.studentId);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: "Student not found."
    });
  }

  return res.json({
    success: true,
    student: publicStudent(student)
  });
});

app.get("/api/packages", (req, res) => {
  const activePackages = packages.filter(
    (pkg) => normalizeText(pkg.status).toLowerCase() === "active"
  );

  return res.json({
    success: true,
    packages: activePackages
  });
});

/* ======================================================
   PAYMENT
====================================================== */

function handlePayment(req, res) {
  const studentId = normalizeText(req.body.studentId);
  const email = normalizeEmail(req.body.email);
  const packageCode = normalizeText(req.body.package || req.body.packageCode).toLowerCase();
  const packageNameInput = normalizeText(req.body.packageName);
  const method = normalizeText(req.body.method);
  const periodInput = normalizeText(req.body.period);
  const priceInput = Number(req.body.price || req.body.amount || 0);

  let student = null;

  if (studentId) {
    student = findStudentByStudentId(studentId);
  }

  if (!student && email) {
    student = findStudentByEmail(email);
  }

  if (!student) {
    return res.status(404).json({
      success: false,
      message: "Student not found."
    });
  }

  if (!method) {
    return res.status(400).json({
      success: false,
      message: "Please choose a payment method."
    });
  }

  let selectedPackage = null;

  if (packageCode) {
    selectedPackage = findPackageByCode(packageCode);
  }

  if (!selectedPackage && packageNameInput) {
    selectedPackage = packages.find(
      (pkg) => normalizeText(pkg.name).toLowerCase() === packageNameInput.toLowerCase()
    );
  }

  if (!selectedPackage) {
    return res.status(400).json({
      success: false,
      message: "Selected package not found."
    });
  }

  const finalAmount = priceInput || Number(selectedPackage.price || 0);
  const finalPeriod = periodInput || selectedPackage.period || "Monthly";

  const payment = {
    id: payments.length + 1,
    paymentId: `PAY-${String(payments.length + 1).padStart(3, "0")}`,
    studentId: student.studentId,
    studentName: student.name,
    email: student.email,
    packageName: selectedPackage.name,
    packageCode: selectedPackage.code,
    amount: finalAmount,
    period: finalPeriod,
    method,
    status: "paid",
    date: new Date().toISOString().slice(0, 10)
  };

  payments.push(payment);

  student.packageName = selectedPackage.name;
  student.packageCode = selectedPackage.code;
  student.subscriptionStatus = "active";
  student.paymentStatus = "paid";
  student.amountPaid = finalAmount;
  student.paymentMethod = method;
  updateStudentAccess(student);

  return res.json({
    success: true,
    message: "Payment completed successfully.",
    redirect: "/exam-access.html",
    payment
  });
}

app.post("/api/pay", handlePayment);
app.post("/api/payment", handlePayment);
app.post("/payment", handlePayment);

/* ======================================================
   EXAM ACCESS
====================================================== */

app.get("/api/exam-access/:studentId", (req, res) => {
  const student = findStudentByStudentId(req.params.studentId);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: "Student not found.",
      subscriptionStatus: "inactive",
      examTitle: "No exam available",
      examUrl: null
    });
  }

  const activeExam = findActiveExam();

  if (!activeExam) {
    return res.json({
      success: false,
      message: "No active exam available.",
      subscriptionStatus: student.subscriptionStatus || "inactive",
      examTitle: "No exam available",
      examUrl: null
    });
  }

  if (
    normalizeText(student.subscriptionStatus).toLowerCase() !== "active" ||
    normalizeText(student.paymentStatus).toLowerCase() !== "paid"
  ) {
    return res.json({
      success: false,
      message: "Subscription inactive. Complete payment first.",
      subscriptionStatus: student.subscriptionStatus || "inactive",
      examTitle: activeExam.title,
      examUrl: null
    });
  }

  return res.json({
    success: true,
    message: "Exam access granted.",
    subscriptionStatus: "active",
    examTitle: activeExam.title,
    examUrl: activeExam.url
  });
});

/* ======================================================
   ADMIN API
====================================================== */

app.get("/api/admin/overview", (req, res) => {
  const totalStudents = students.length;
  const activeSubscriptions = students.filter(
    (student) => normalizeText(student.subscriptionStatus).toLowerCase() === "active"
  ).length;
  const inactiveSubscriptions = students.filter(
    (student) => normalizeText(student.subscriptionStatus).toLowerCase() !== "active"
  ).length;
  const paidStudents = students.filter(
    (student) => normalizeText(student.paymentStatus).toLowerCase() === "paid"
  ).length;
  const pendingPayments = students.filter(
    (student) => normalizeText(student.paymentStatus).toLowerCase() !== "paid"
  ).length;
  const totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const activeExamLinks = exams.filter(
    (exam) => normalizeText(exam.status).toLowerCase() === "active"
  ).length;
  const totalPackages = packages.length;

  res.json({
    totalStudents,
    activeSubscriptions,
    inactiveSubscriptions,
    paidStudents,
    pendingPayments,
    totalRevenue,
    activeExamLinks,
    totalPackages
  });
});

app.get("/api/admin/students", (req, res) => {
  let result = students.map((student) => publicStudent(student));

  const q = normalizeText(req.query.q).toLowerCase();
  const subscription = normalizeText(req.query.subscription).toLowerCase();
  const payment = normalizeText(req.query.payment).toLowerCase();
  const pkg = normalizeText(req.query.package).toLowerCase();

  if (q) {
    result = result.filter((student) =>
      student.name.toLowerCase().includes(q) ||
      student.studentId.toLowerCase().includes(q) ||
      student.email.toLowerCase().includes(q)
    );
  }

  if (subscription) {
    result = result.filter((student) =>
      normalizeText(student.subscriptionStatus).toLowerCase() === subscription
    );
  }

  if (payment) {
    result = result.filter((student) =>
      normalizeText(student.paymentStatus).toLowerCase() === payment
    );
  }

  if (pkg) {
    result = result.filter((student) =>
      normalizeText(student.packageCode).toLowerCase() === pkg ||
      normalizeText(student.packageName).toLowerCase() === pkg
    );
  }

  res.json(result);
});

app.post("/api/admin/students", (req, res) => {
  const name = normalizeText(req.body.name);
  const email = normalizeEmail(req.body.email);
  const phone = normalizeText(req.body.phone);
  const region = normalizeText(req.body.region);
  const status = normalizeText(req.body.status || "active");
  const password = normalizeText(req.body.password || "12345");

  if (!name || !email || !phone || !region) {
    return res.status(400).json({
      success: false,
      message: "Name, email, phone and region are required."
    });
  }

  if (findStudentByEmail(email)) {
    return res.status(409).json({
      success: false,
      message: "Student email already exists."
    });
  }

  const newStudent = {
    id: students.length + 1,
    studentId: generateStudentId(region),
    name,
    phone,
    region,
    email,
    password,
    status,
    packageName: "",
    packageCode: "",
    subscriptionStatus: "inactive",
    paymentStatus: "pending",
    amountPaid: 0,
    paymentMethod: "",
    examAccessStatus: "blocked",
    registeredDate: new Date().toISOString().slice(0, 10)
  };

  students.push(newStudent);

  res.json({
    success: true,
    message: "Student saved successfully.",
    student: publicStudent(newStudent)
  });
});

app.patch("/api/admin/students/:studentId/manage", (req, res) => {
  const student = findStudentByStudentId(req.params.studentId);

  if (!student) {
    return res.status(404).json({
      success: false,
      message: "Student not found."
    });
  }

  const packageCode = normalizeText(req.body.packageCode).toLowerCase();
  const subscriptionStatus = normalizeText(req.body.subscriptionStatus).toLowerCase();
  const paymentStatus = normalizeText(req.body.paymentStatus).toLowerCase();
  const amountPaid = req.body.amountPaid !== undefined ? Number(req.body.amountPaid || 0) : student.amountPaid;
  const paymentMethod = normalizeText(req.body.paymentMethod || student.paymentMethod);

  if (packageCode) {
    const selectedPackage = findPackageByCode(packageCode);

    if (!selectedPackage) {
      return res.status(400).json({
        success: false,
        message: "Selected package not found."
      });
    }

    student.packageCode = selectedPackage.code;
    student.packageName = selectedPackage.name;

    if (paymentStatus === "paid" && (!amountPaid || amountPaid <= 0)) {
      student.amountPaid = Number(selectedPackage.price || 0);
    }
  }

  if (subscriptionStatus === "active" || subscriptionStatus === "inactive") {
    student.subscriptionStatus = subscriptionStatus;
  }

  if (paymentStatus === "paid" || paymentStatus === "pending") {
    student.paymentStatus = paymentStatus;
  }

  student.amountPaid = Number.isNaN(amountPaid) ? 0 : amountPaid;
  student.paymentMethod = paymentMethod;

  if (student.paymentStatus !== "paid") {
    student.amountPaid = 0;
    student.paymentMethod = paymentMethod || "";
  }

  if (!student.packageCode) {
    student.packageName = "";
  }

  updateStudentAccess(student);

  res.json({
    success: true,
    message: "Student subscription and payment updated successfully.",
    student: publicStudent(student)
  });
});

app.get("/api/admin/packages", (req, res) => {
  const result = packages.map((pkg) => ({
    ...pkg,
    studentsCount: countStudentsUsingPackage(pkg.name)
  }));

  res.json(result);
});

app.post("/api/admin/packages", (req, res) => {
  const name = normalizeText(req.body.name);
  const price = Number(req.body.price || 0);
  const duration = normalizeText(req.body.duration || req.body.period);
  const description = normalizeText(req.body.description);
  const status = normalizeText(req.body.status || "active");
  const code = normalizeText(req.body.code) || name.toLowerCase().replace(/\s+/g, "-");

  if (!name || !price || !duration) {
    return res.status(400).json({
      success: false,
      message: "Package name, price and duration are required."
    });
  }

  const newPackage = {
    id: packages.length + 1,
    code,
    name,
    price,
    period: duration,
    description,
    status,
    createdDate: new Date().toISOString().slice(0, 10)
  };

  packages.push(newPackage);

  res.json({
    success: true,
    message: "Package saved successfully.",
    package: newPackage
  });
});

app.get("/api/admin/payments", (req, res) => {
  res.json(payments);
});

app.get("/api/admin/exams", (req, res) => {
  const result = exams.map((exam) => ({
    ...exam,
    allowedStudents: students.filter(
      (student) => normalizeText(student.examAccessStatus).toLowerCase() === "allowed"
    ).length
  }));

  res.json(result);
});

app.post("/api/admin/exams", (req, res) => {
  const title = normalizeText(req.body.title);
  const url = normalizeText(req.body.url);
  const groupName = normalizeText(req.body.groupName);
  const status = normalizeText(req.body.status || "active");

  if (!title || !url) {
    return res.status(400).json({
      success: false,
      message: "Exam title and exam link are required."
    });
  }

  const newExam = {
    id: exams.length + 1,
    title,
    url,
    groupName,
    status,
    dateAdded: new Date().toISOString().slice(0, 10)
  };

  exams.push(newExam);

  res.json({
    success: true,
    message: "Exam link saved successfully.",
    exam: newExam
  });
});

/* ======================================================
   API 404
====================================================== */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});