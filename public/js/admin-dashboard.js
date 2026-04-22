window.addEventListener("load", function () {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".panel");

  let revenueChartInstance = null;
  let subscriptionChartInstance = null;
  let allPackages = [];

  function openPanel(panelId) {
    panels.forEach((panel) => panel.classList.remove("active"));
    tabButtons.forEach((btn) => btn.classList.remove("active"));

    const targetPanel = document.getElementById(panelId);
    const activeButton = document.querySelector(`.tab-btn[data-tab="${panelId}"]`);

    if (targetPanel) targetPanel.classList.add("active");
    if (activeButton) activeButton.classList.add("active");
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const panelId = this.getAttribute("data-tab");
      openPanel(panelId);
    });
  });

  function statusBadge(status) {
    const value = (status || "").toLowerCase();
    return `<span class="status ${value}">${status || "-"}</span>`;
  }

  async function safeJson(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    return JSON.parse(text);
  }

  function showMessage(element, text, type) {
    if (!element) return;
    element.className = "message " + type;
    element.textContent = text;

    setTimeout(() => {
      element.className = "message";
      element.textContent = "";
    }, 4000);
  }

  function renderRevenueChart(totalRevenue, paidStudents, pendingPayments) {
    const canvas = document.getElementById("revenueChart");
    if (!canvas) return;

    if (revenueChartInstance) {
      revenueChartInstance.destroy();
    }

    revenueChartInstance = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Revenue", "Paid Students", "Pending Payments"],
        datasets: [
          {
            label: "Business Overview",
            data: [totalRevenue, paidStudents, pendingPayments]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  function renderSubscriptionChart(activeSubscriptions, inactiveSubscriptions) {
    const canvas = document.getElementById("subscriptionChart");
    if (!canvas) return;

    if (subscriptionChartInstance) {
      subscriptionChartInstance.destroy();
    }

    subscriptionChartInstance = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Active", "Inactive"],
        datasets: [
          {
            data: [activeSubscriptions, inactiveSubscriptions]
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: "bottom" }
        }
      }
    });
  }

  const studentsTableBody = document.getElementById("studentsTableBody");
  const packagesTableBody = document.getElementById("packagesTableBody");
  const paymentsTableBody = document.getElementById("paymentsTableBody");
  const examTableBody = document.getElementById("examTableBody");

  const totalStudents = document.getElementById("totalStudents");
  const activeSubscriptions = document.getElementById("activeSubscriptions");
  const inactiveSubscriptions = document.getElementById("inactiveSubscriptions");
  const paidStudents = document.getElementById("paidStudents");
  const pendingPayments = document.getElementById("pendingPayments");
  const totalRevenue = document.getElementById("totalRevenue");
  const activeExamLinks = document.getElementById("activeExamLinks");
  const totalPackages = document.getElementById("totalPackages");

  const studentMessage = document.getElementById("studentMessage");
  const packageMessage = document.getElementById("packageMessage");
  const examMessage = document.getElementById("examMessage");

  async function loadOverview() {
    try {
      const data = await safeJson("/api/admin/overview");

      totalStudents.textContent = data.totalStudents || 0;
      activeSubscriptions.textContent = data.activeSubscriptions || 0;
      inactiveSubscriptions.textContent = data.inactiveSubscriptions || 0;
      paidStudents.textContent = data.paidStudents || 0;
      pendingPayments.textContent = data.pendingPayments || 0;
      totalRevenue.textContent = "TZS " + Number(data.totalRevenue || 0).toLocaleString();
      activeExamLinks.textContent = data.activeExamLinks || 0;
      totalPackages.textContent = data.totalPackages || 0;

      renderRevenueChart(
        Number(data.totalRevenue || 0),
        Number(data.paidStudents || 0),
        Number(data.pendingPayments || 0)
      );

      renderSubscriptionChart(
        Number(data.activeSubscriptions || 0),
        Number(data.inactiveSubscriptions || 0)
      );
    } catch (error) {
      console.error("Overview error:", error);
    }
  }

  async function loadPackages() {
    try {
      const packages = await safeJson("/api/admin/packages");
      allPackages = packages;

      packagesTableBody.innerHTML = "";
      packages.forEach((pkg) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${pkg.name || "-"}</td>
          <td>${pkg.code || "-"}</td>
          <td>${pkg.price ? "TZS " + Number(pkg.price).toLocaleString() : "-"}</td>
          <td>${pkg.period || "-"}</td>
          <td>${pkg.description || "-"}</td>
          <td>${statusBadge(pkg.status || "inactive")}</td>
          <td>${pkg.studentsCount || 0}</td>
          <td>${pkg.createdDate || "-"}</td>
        `;
        packagesTableBody.appendChild(tr);
      });
    } catch (error) {
      console.error("Packages error:", error);
    }
  }

  function packageOptions(currentCode = "") {
    const base = [`<option value="">No package</option>`];
    allPackages.forEach((pkg) => {
      base.push(
        `<option value="${pkg.code}" ${currentCode === pkg.code ? "selected" : ""}>${pkg.name}</option>`
      );
    });
    return base.join("");
  }

  async function loadStudents(queryString = "") {
    try {
      const students = await safeJson("/api/admin/students" + queryString);

      studentsTableBody.innerHTML = "";
      students.forEach((student) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
          <td>${student.studentId || "-"}</td>
          <td>${student.name || "-"}</td>
          <td>${student.email || "-"}</td>
          <td>${student.phone || "-"}</td>
          <td>${student.region || "-"}</td>
          <td>${student.registeredDate || "-"}</td>
          <td>${student.packageName || "-"}</td>
          <td>${statusBadge(student.subscriptionStatus || "inactive")}</td>
          <td>${statusBadge(student.paymentStatus || "pending")}</td>
          <td>${student.amountPaid ? "TZS " + Number(student.amountPaid).toLocaleString() : "TZS 0"}</td>
          <td>${student.paymentMethod || "-"}</td>
          <td>${statusBadge(student.examAccessStatus || "blocked")}</td>
          <td>
            <div class="manage-box">
              <select class="manage-package">
                ${packageOptions(student.packageCode || "")}
              </select>

              <select class="manage-subscription">
                <option value="active" ${student.subscriptionStatus === "active" ? "selected" : ""}>Active</option>
                <option value="inactive" ${student.subscriptionStatus === "inactive" ? "selected" : ""}>Inactive</option>
              </select>

              <select class="manage-payment">
                <option value="paid" ${student.paymentStatus === "paid" ? "selected" : ""}>Paid</option>
                <option value="pending" ${student.paymentStatus === "pending" ? "selected" : ""}>Pending</option>
              </select>

              <input class="manage-amount" type="number" value="${student.amountPaid || 0}" placeholder="Amount paid">
              <input class="manage-method" type="text" value="${student.paymentMethod || ""}" placeholder="Payment method">

              <button class="manage-save">Save Changes</button>
            </div>
          </td>
        `;

        const saveBtn = tr.querySelector(".manage-save");
        const packageSelect = tr.querySelector(".manage-package");
        const subscriptionSelect = tr.querySelector(".manage-subscription");
        const paymentSelect = tr.querySelector(".manage-payment");
        const amountInput = tr.querySelector(".manage-amount");
        const methodInput = tr.querySelector(".manage-method");

        saveBtn.addEventListener("click", async () => {
          try {
            const result = await safeJson(`/api/admin/students/${student.studentId}/manage`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                packageCode: packageSelect.value,
                subscriptionStatus: subscriptionSelect.value,
                paymentStatus: paymentSelect.value,
                amountPaid: amountInput.value,
                paymentMethod: methodInput.value
              })
            });

            if (result.success) {
              showMessage(studentMessage, `Student ${student.studentId} updated successfully.`, "success");
              await loadOverview();
              await loadStudents(queryString);
              await loadPayments();
            } else {
              showMessage(studentMessage, result.message || "Failed to update student.", "error");
            }
          } catch (error) {
            showMessage(studentMessage, "Failed to update student.", "error");
          }
        });

        studentsTableBody.appendChild(tr);
      });
    } catch (error) {
      console.error("Students error:", error);
    }
  }

  async function loadPayments() {
    try {
      const payments = await safeJson("/api/admin/payments");

      paymentsTableBody.innerHTML = "";
      payments.forEach((payment) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${payment.paymentId || "-"}</td>
          <td>${payment.studentId || "-"}</td>
          <td>${payment.studentName || "-"}</td>
          <td>${payment.email || "-"}</td>
          <td>${payment.packageName || "-"}</td>
          <td>${payment.amount ? "TZS " + Number(payment.amount).toLocaleString() : "-"}</td>
          <td>${payment.period || "-"}</td>
          <td>${payment.method || "-"}</td>
          <td>${statusBadge(payment.status || "pending")}</td>
          <td>${payment.date || "-"}</td>
        `;
        paymentsTableBody.appendChild(tr);
      });
    } catch (error) {
      console.error("Payments error:", error);
    }
  }

  async function loadExams() {
    try {
      const exams = await safeJson("/api/admin/exams");

      examTableBody.innerHTML = "";
      exams.forEach((exam) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${exam.title || "-"}</td>
          <td>${exam.url ? `<a href="${exam.url}" target="_blank">Open Link</a>` : "-"}</td>
          <td>${exam.groupName || "-"}</td>
          <td>${statusBadge(exam.status || "inactive")}</td>
          <td>${exam.dateAdded || "-"}</td>
          <td>${exam.allowedStudents || 0}</td>
        `;
        examTableBody.appendChild(tr);
      });
    } catch (error) {
      console.error("Exams error:", error);
    }
  }

  const applyFiltersBtn = document.getElementById("applyStudentFiltersBtn");
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", function () {
      const q = document.getElementById("studentSearch").value.trim();
      const subscription = document.getElementById("studentSubscriptionFilter").value;
      const payment = document.getElementById("studentPaymentFilter").value;
      const pkg = document.getElementById("studentPackageFilter").value.trim();

      const params = new URLSearchParams();
      if (q) params.append("q", q);
      if (subscription) params.append("subscription", subscription);
      if (payment) params.append("payment", payment);
      if (pkg) params.append("package", pkg);

      const queryString = params.toString() ? "?" + params.toString() : "";
      loadStudents(queryString);
    });
  }

  const resetFiltersBtn = document.getElementById("resetStudentFiltersBtn");
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener("click", function () {
      document.getElementById("studentSearch").value = "";
      document.getElementById("studentSubscriptionFilter").value = "";
      document.getElementById("studentPaymentFilter").value = "";
      document.getElementById("studentPackageFilter").value = "";
      loadStudents();
    });
  }

  const saveStudentBtn = document.getElementById("saveStudentBtn");
  if (saveStudentBtn) {
    saveStudentBtn.addEventListener("click", async function () {
      const name = document.getElementById("studentName").value.trim();
      const email = document.getElementById("studentEmail").value.trim();
      const phone = document.getElementById("studentPhone").value.trim();
      const region = document.getElementById("studentRegion").value.trim();
      const password = document.getElementById("studentPassword").value.trim() || "12345";

      if (!name || !email || !phone || !region) {
        showMessage(studentMessage, "Name, email, phone and region are required.", "error");
        return;
      }

      try {
        const result = await safeJson("/api/admin/students", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, phone, region, password })
        });

        if (result.success) {
          showMessage(studentMessage, result.message || "Student saved successfully.", "success");
          document.getElementById("studentName").value = "";
          document.getElementById("studentEmail").value = "";
          document.getElementById("studentPhone").value = "";
          document.getElementById("studentRegion").value = "";
          document.getElementById("studentPassword").value = "";
          await loadOverview();
          await loadStudents();
        } else {
          showMessage(studentMessage, result.message || "Failed to save student.", "error");
        }
      } catch (error) {
        showMessage(studentMessage, "Failed to save student.", "error");
      }
    });
  }

  const savePackageBtn = document.getElementById("savePackageBtn");
  if (savePackageBtn) {
    savePackageBtn.addEventListener("click", async function () {
      const name = document.getElementById("packageName").value.trim();
      const code = document.getElementById("packageCode").value.trim();
      const price = document.getElementById("packagePrice").value.trim();
      const duration = document.getElementById("packageDuration").value.trim();
      const description = document.getElementById("packageDescription").value.trim();
      const status = document.getElementById("packageStatus").value;

      if (!name || !price || !duration) {
        showMessage(packageMessage, "Package name, price and duration are required.", "error");
        return;
      }

      try {
        const result = await safeJson("/api/admin/packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, code, price, duration, description, status })
        });

        if (result.success) {
          showMessage(packageMessage, result.message || "Package saved successfully.", "success");
          document.getElementById("packageName").value = "";
          document.getElementById("packageCode").value = "";
          document.getElementById("packagePrice").value = "";
          document.getElementById("packageDuration").value = "";
          document.getElementById("packageDescription").value = "";
          document.getElementById("packageStatus").value = "active";
          await loadPackages();
          await loadOverview();
          await loadStudents();
        } else {
          showMessage(packageMessage, result.message || "Failed to save package.", "error");
        }
      } catch (error) {
        showMessage(packageMessage, "Failed to save package.", "error");
      }
    });
  }

  const saveExamBtn = document.getElementById("saveExamBtn");
  if (saveExamBtn) {
    saveExamBtn.addEventListener("click", async function () {
      const title = document.getElementById("examTitle").value.trim();
      const url = document.getElementById("examUrl").value.trim();
      const groupName = document.getElementById("examGroup").value.trim();
      const status = document.getElementById("examStatus").value;

      if (!title || !url) {
        showMessage(examMessage, "Exam title and exam link are required.", "error");
        return;
      }

      try {
        const result = await safeJson("/api/admin/exams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, url, groupName, status })
        });

        if (result.success) {
          showMessage(examMessage, result.message || "Exam link saved successfully.", "success");
          document.getElementById("examTitle").value = "";
          document.getElementById("examUrl").value = "";
          document.getElementById("examGroup").value = "";
          document.getElementById("examStatus").value = "active";
          await loadExams();
          await loadOverview();
        } else {
          showMessage(examMessage, result.message || "Failed to save exam link.", "error");
        }
      } catch (error) {
        showMessage(examMessage, "Failed to save exam link.", "error");
      }
    });
  }

  const loadStudentsBtn = document.getElementById("loadStudentsBtn");
  if (loadStudentsBtn) loadStudentsBtn.addEventListener("click", () => loadStudents());

  const loadPackagesBtn = document.getElementById("loadPackagesBtn");
  if (loadPackagesBtn) loadPackagesBtn.addEventListener("click", async () => {
    await loadPackages();
    await loadStudents();
  });

  const loadPaymentsBtn = document.getElementById("loadPaymentsBtn");
  if (loadPaymentsBtn) loadPaymentsBtn.addEventListener("click", () => loadPayments());

  const loadExamsBtn = document.getElementById("loadExamsBtn");
  if (loadExamsBtn) loadExamsBtn.addEventListener("click", () => loadExams());

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      window.location.href = "/login";
    });
  }

  async function init() {
    openPanel("overview");
    await loadPackages();
    await loadOverview();
    await loadStudents();
    await loadPayments();
    await loadExams();
  }

  init();
});