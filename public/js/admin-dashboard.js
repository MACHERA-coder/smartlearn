console.log("SmartLearn Admin JS Loaded");

(function () {
  function requestJson(url, options = {}) {
    return fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      ...options
    }).then(async (response) => {
      let data = {};
      try {
        data = await response.json();
      } catch (error) {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.message || "Request failed.");
      }

      return data;
    });
  }

  async function updatePaymentStatus(id, status) {
    const result = await requestJson(`/admin/payments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });

    alert(result.message || "Payment updated successfully.");
    await window.loadDashboardData();
    window.showSection("paymentsSection");
  }

  async function changeStudentStatus(id, status) {
    const result = await requestJson(`/admin/students/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });

    alert(result.message || "Student status updated successfully.");
    await window.loadDashboardData();
    window.showSection("studentsSection");
  }

  async function deleteStudent(id) {
    const confirmed = confirm("Are you sure you want to delete this student?");
    if (!confirmed) return;

    const result = await requestJson(`/admin/students/${id}`, {
      method: "DELETE"
    });

    alert(result.message || "Student deleted successfully.");
    await window.loadDashboardData();
    window.showSection("studentsSection");
  }

  async function updateExamLink(id, payload) {
    const result = await requestJson(`/admin/exam-links/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    alert(result.message || "Exam link updated successfully.");
    await window.loadDashboardData();
    window.showSection("examLinksSection");
  }

  async function deleteExamLink(id) {
    const confirmed = confirm("Are you sure you want to delete this exam link?");
    if (!confirmed) return;

    const result = await requestJson(`/admin/exam-links/${id}`, {
      method: "DELETE"
    });

    alert(result.message || "Exam link deleted successfully.");
    await window.loadDashboardData();
    window.showSection("examLinksSection");
  }

  function getExamById(id) {
    if (!window.dashboardData || !Array.isArray(window.dashboardData.examLinks)) return null;
    return window.dashboardData.examLinks.find(item => Number(item.id) === Number(id)) || null;
  }

  async function editExamLink(exam) {
    const title = prompt("Edit Exam Title:", exam.title || "");
    if (title === null) return;

    const packageName = prompt("Edit Package (Basic / Standard / Premium / All):", exam.package || "All");
    if (packageName === null) return;

    const url = prompt("Edit Exam URL:", exam.url || "");
    if (url === null) return;

    const status = prompt("Edit Base Status (live / draft / closed):", String(exam.base_status || exam.status || "draft").toLowerCase());
    if (status === null) return;

    const startAt = prompt("Edit Go Live At (example: 2026-04-23T18:00, leave empty if none):", exam.start_at || "");
    if (startAt === null) return;

    const endAt = prompt("Edit Auto Close At (example: 2026-04-23T20:00, leave empty if none):", exam.end_at || "");
    if (endAt === null) return;

    const description = prompt("Edit Description:", exam.description || "");
    if (description === null) return;

    if (!title.trim() || !packageName.trim() || !url.trim() || !status.trim()) {
      alert("Title, package, URL, and status are required.");
      return;
    }

    if (startAt && endAt && endAt <= startAt) {
      alert("Auto close time must be later than go-live time.");
      return;
    }

    await updateExamLink(exam.id, {
      title: title.trim(),
      package: packageName.trim(),
      url: url.trim(),
      status: status.trim(),
      start_at: startAt.trim(),
      end_at: endAt.trim(),
      description: description.trim()
    });
  }

  async function bindActionChange(event) {
    const select = event.target.closest("select");
    if (!select) return;

    if (select.dataset.paymentId) {
      const id = select.dataset.paymentId;
      const action = select.value;
      select.value = "";
      if (!action) return;
      await updatePaymentStatus(id, action);
      return;
    }

    if (select.dataset.studentId) {
      const id = select.dataset.studentId;
      const action = select.value;
      select.value = "";
      if (!action) return;

      if (action === "delete") {
        await deleteStudent(id);
        return;
      }

      await changeStudentStatus(id, action);
      return;
    }

    if (select.dataset.examId) {
      const id = select.dataset.examId;
      const action = select.value;
      select.value = "";
      if (!action) return;

      const exam = getExamById(id);
      if (!exam) {
        alert("Exam link not found.");
        return;
      }

      if (action === "edit") {
        await editExamLink(exam);
        return;
      }

      if (action === "delete") {
        await deleteExamLink(id);
        return;
      }
let newStatus = action;

if(action === "go-live") newStatus = "live";
if(action === "set-scheduled") newStatus = "scheduled";
if(action === "set-draft") newStatus = "draft";
if(action === "set-closed") newStatus = "closed";
      await updateExamLink(id, {
        title: exam.title,
        package: exam.package,
        url: exam.url,
        status: newStatus,
        start_at: exam.start_at || "",
        end_at: exam.end_at || "",
        description: exam.description || ""
      });
    }
  }

  function overridePaymentsRender() {
    if (typeof window.renderPaymentsTable !== "function") return;

    window.renderPaymentsTable = function (data = window.dashboardData.payments) {
      const tableBody = document.getElementById("paymentsTableBody");
      if (!tableBody) return;

      if (!data.length) {
        tableBody.innerHTML = `<tr><td colspan="6" class="muted">No payments found.</td></tr>`;
        return;
      }

      tableBody.innerHTML = data.map(item => `
        <tr>
          <td>${item.student_name || item.name || "N/A"}</td>
          <td>${item.amount || "0"}</td>
          <td>${item.method || "N/A"}</td>
          <td>${item.reference || "N/A"}</td>
          <td>${item.date || item.created_at || "N/A"}</td>
          <td>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              ${window.getBadge(item.status || "Pending")}
              <select class="action-select" data-payment-id="${Number(item.id)}">
                <option value="">Action</option>
                <option value="Approved">Approve</option>
                <option value="Rejected">Reject</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </td>
        </tr>
      `).join("");
    };
  }

  document.addEventListener("change", bindActionChange);

  function init() {
    overridePaymentsRender();
    if (typeof window.renderPaymentsTable === "function") window.renderPaymentsTable();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();