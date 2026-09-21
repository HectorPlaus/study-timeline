const STORAGE_KEY = "studyTimeline.v1";

const timeline = document.getElementById("timeline");
const emptyState = document.getElementById("emptyState");
const timelineView = document.getElementById("timelineView");
const summaryView = document.getElementById("summaryView");
const summaryList = document.getElementById("summaryList");
const summaryEmptyState = document.getElementById("summaryEmptyState");
const modal = document.getElementById("modal");
const form = document.getElementById("topicForm");

const fields = {
  id: document.getElementById("topicId"),
  title: document.getElementById("title"),
  dateType: document.getElementById("dateType"),
  year: document.getElementById("year"),
  month: document.getElementById("month"),
  day: document.getElementById("day"),
  century: document.getElementById("century"),
  era: document.getElementById("era"),
  yearFrom: document.getElementById("yearFrom"),
  yearTo: document.getElementById("yearTo"),
  centuryFrom: document.getElementById("centuryFrom"),
  eraFrom: document.getElementById("eraFrom"),
  centuryTo: document.getElementById("centuryTo"),
  eraTo: document.getElementById("eraTo"),
  category: document.getElementById("category"),
  description: document.getElementById("description"),
  color: document.getElementById("color")
};

let topics = migrateTopics(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"));

const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Convierte datos antiguos al nuevo modelo (dateType + año/mes/día, o siglo, o rangos),
// que sí admite fechas anteriores a Cristo y fechas imprecisas.
function migrateTopics(list) {
  return list.map(topic => {
    let t = { ...topic };

    // Formato muy antiguo: campo "date" tipo YYYY-MM-DD
    if (t.year === undefined && t.date) {
      const parsed = new Date(t.date + "T00:00:00");
      if (!Number.isNaN(parsed.getTime())) {
        t.year = parsed.getFullYear();
        t.month = parsed.getMonth() + 1;
        t.day = parsed.getDate();
      }
    }
    delete t.date;

    if (t.dateType === undefined) t.dateType = "exact";
    if (t.year === undefined) t.year = null;

    return t;
  });
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(topics));
}

function escapeHTML(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toRoman(num) {
  const map = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]
  ];
  let n = Math.round(Number(num));
  if (!n || n < 1) return String(num);
  let result = "";
  for (const [value, symbol] of map) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

function eraLabel(era) {
  return era === "AC" ? "a.C." : "d.C.";
}

function yearLabel(year) {
  const y = Number(year);
  return `${Math.abs(y).toLocaleString("es-ES")} ${y < 0 ? "a.C." : "d.C."}`;
}

// Convierte un siglo (1, 2, 3...) + era en su rango de años astronómicos
// (negativos = a.C.), donde "start" es el año más antiguo del siglo.
function centuryToYearRange(century, era) {
  const n = Number(century);
  if (!n) return null;
  if (era === "AC") {
    return { start: -(n * 100), end: -((n - 1) * 100 + 1) };
  }
  return { start: (n - 1) * 100 + 1, end: n * 100 };
}

function formatDate(topic) {
  const type = topic.dateType || "exact";

  if (type === "century") {
    if (!topic.century) return "Sin fecha";
    return `Siglo ${toRoman(topic.century)} ${eraLabel(topic.era)}`;
  }

  if (type === "yearRange") {
    if (topic.yearFrom == null || topic.yearTo == null) return "Sin fecha";
    return `${yearLabel(topic.yearFrom)} – ${yearLabel(topic.yearTo)}`;
  }

  if (type === "centuryRange") {
    if (!topic.centuryFrom || !topic.centuryTo) return "Sin fecha";
    return `Siglo ${toRoman(topic.centuryFrom)} ${eraLabel(topic.eraFrom)} – Siglo ${toRoman(topic.centuryTo)} ${eraLabel(topic.eraTo)}`;
  }

  // exact
  if (topic.year === null || topic.year === undefined || topic.year === "") {
    return "Sin fecha";
  }
  const yl = yearLabel(topic.year);
  if (topic.month) {
    const monthLabel = monthNames[Number(topic.month) - 1];
    return topic.day ? `${topic.day} ${monthLabel} ${yl}` : `${monthLabel} ${yl}`;
  }
  return yl;
}

// Valor numérico continuo para ordenar cronológicamente (años negativos = a.C.,
// más negativo = más antiguo). Para fechas exactas es el propio año; para siglos
// y rangos se usa el punto medio, así se intercalan bien con fechas exactas
// cercanas. Los temas sin fecha van al final.
function sortValue(topic) {
  const type = topic.dateType || "exact";

  if (type === "century") {
    if (!topic.century) return Infinity;
    const r = centuryToYearRange(topic.century, topic.era);
    return r ? (r.start + r.end) / 2 : Infinity;
  }

  if (type === "yearRange") {
    if (topic.yearFrom == null || topic.yearTo == null) return Infinity;
    return (Number(topic.yearFrom) + Number(topic.yearTo)) / 2;
  }

  if (type === "centuryRange") {
    if (!topic.centuryFrom || !topic.centuryTo) return Infinity;
    const rFrom = centuryToYearRange(topic.centuryFrom, topic.eraFrom);
    const rTo = centuryToYearRange(topic.centuryTo, topic.eraTo);
    if (!rFrom || !rTo) return Infinity;
    return (rFrom.start + rTo.end) / 2;
  }

  if (topic.year === null || topic.year === undefined || topic.year === "") return Infinity;
  const year = Number(topic.year);
  const month = topic.month ? (Number(topic.month) - 1) / 12 : 0;
  const day = topic.day ? (Number(topic.day) - 1) / 372 : 0;
  return year + month + day;
}

function updateDateFieldsVisibility() {
  const type = fields.dateType.value;
  document.querySelectorAll(".date-fields").forEach(el => {
    el.classList.toggle("hidden", el.dataset.type !== type);
  });
}

function updateCategoryFilter() {
  const select = document.getElementById("categoryFilter");
  const current = select.value;

  const categories = [...new Set(topics.map(t => t.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  select.innerHTML = `<option value="all">Todas las categorías</option>`;
  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if (categories.includes(current)) select.value = current;
}

function render() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  const category = document.getElementById("categoryFilter").value;

  let filtered = topics.filter(topic => {
    const matchesQuery =
      topic.title.toLowerCase().includes(query) ||
      (topic.description || "").toLowerCase().includes(query) ||
      (topic.category || "").toLowerCase().includes(query);

    const matchesCategory = category === "all" || topic.category === category;

    return matchesQuery && matchesCategory;
  });

  filtered.sort((a, b) => sortValue(a) - sortValue(b));

  renderTimeline(filtered);
  renderSummary(filtered);
}

function topicCardHTML(topic) {
  return `
    <div class="card-date">${formatDate(topic)}</div>
    <h3>${escapeHTML(topic.title)}</h3>
    ${topic.description ? `<p>${escapeHTML(topic.description)}</p>` : ""}
    <div class="card-tags">
      ${topic.category ? `<span class="badge">${escapeHTML(topic.category)}</span>` : ""}
    </div>
    <div class="card-actions">
      <button class="edit-btn" data-edit="${topic.id}">Editar →</button>
    </div>
  `;
}

function renderTimeline(filtered) {
  timeline.innerHTML = "";
  emptyState.style.display = filtered.length ? "none" : "block";

  filtered.forEach(topic => {
    const item = document.createElement("article");
    item.className = "timeline-item";
    item.style.setProperty("--item-color", topic.color);
    item.innerHTML = `<div class="timeline-dot"></div><div class="card">${topicCardHTML(topic)}</div>`;
    timeline.appendChild(item);
  });
}

function renderSummary(filtered) {
  summaryList.innerHTML = "";
  summaryEmptyState.style.display = filtered.length ? "none" : "block";

  if (!filtered.length) return;

  const groups = new Map();
  filtered.forEach(topic => {
    const key = topic.category || "Sin categoría";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(topic);
  });

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === "Sin categoría") return 1;
    if (b === "Sin categoría") return -1;
    return a.localeCompare(b);
  });

  sortedKeys.forEach(key => {
    const section = document.createElement("div");
    section.className = "summary-group";
    section.innerHTML = `<h3>${escapeHTML(key)} <span class="summary-count">${groups.get(key).length}</span></h3>`;

    const grid = document.createElement("div");
    grid.className = "summary-grid";

    groups.get(key).forEach(topic => {
      const item = document.createElement("article");
      item.className = "summary-item";
      item.style.setProperty("--item-color", topic.color);
      item.innerHTML = `<div class="card">${topicCardHTML(topic)}</div>`;
      grid.appendChild(item);
    });

    section.appendChild(grid);
    summaryList.appendChild(section);
  });
}

function switchView(view) {
  const isTimeline = view === "timeline";
  timelineView.classList.toggle("hidden", !isTimeline);
  summaryView.classList.toggle("hidden", isTimeline);
  document.getElementById("viewTimelineBtn").classList.toggle("active", isTimeline);
  document.getElementById("viewSummaryBtn").classList.toggle("active", !isTimeline);
}

document.querySelectorAll(".view-btn").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

function openModal(topic = null) {
  form.reset();

  if (topic) {
    document.getElementById("modalTitle").textContent = "Editar tema";
    document.getElementById("deleteBtn").classList.remove("hidden");

    fields.id.value = topic.id;
    fields.title.value = topic.title;
    fields.dateType.value = topic.dateType || "exact";

    fields.year.value = topic.year ?? "";
    fields.month.value = topic.month ?? "";
    fields.day.value = topic.day ?? "";

    fields.century.value = topic.century ?? "";
    fields.era.value = topic.era || "DC";

    fields.yearFrom.value = topic.yearFrom ?? "";
    fields.yearTo.value = topic.yearTo ?? "";

    fields.centuryFrom.value = topic.centuryFrom ?? "";
    fields.eraFrom.value = topic.eraFrom || "AC";
    fields.centuryTo.value = topic.centuryTo ?? "";
    fields.eraTo.value = topic.eraTo || "DC";

    fields.category.value = topic.category;
    fields.description.value = topic.description;
    fields.color.value = topic.color;
  } else {
    document.getElementById("modalTitle").textContent = "Añadir tema";
    document.getElementById("deleteBtn").classList.add("hidden");

    fields.id.value = "";
    fields.dateType.value = "exact";
    fields.era.value = "DC";
    fields.eraFrom.value = "DC";
    fields.eraTo.value = "DC";
    fields.color.value = "#7c5cff";
  }

  updateDateFieldsVisibility();
  modal.classList.remove("hidden");
  fields.title.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  form.reset();
}

function numOrNull(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const dateType = fields.dateType.value;

  const data = {
    title: fields.title.value.trim(),
    dateType,
    year: null, month: null, day: null,
    century: null, era: null,
    yearFrom: null, yearTo: null,
    centuryFrom: null, eraFrom: null, centuryTo: null, eraTo: null,
    category: fields.category.value.trim(),
    description: fields.description.value.trim(),
    status: "pending",
    color: fields.color.value,
    progress: 0
  };

  if (dateType === "century") {
    data.century = numOrNull(fields.century.value);
    data.era = fields.era.value;
  } else if (dateType === "yearRange") {
    data.yearFrom = numOrNull(fields.yearFrom.value);
    data.yearTo = numOrNull(fields.yearTo.value);
  } else if (dateType === "centuryRange") {
    data.centuryFrom = numOrNull(fields.centuryFrom.value);
    data.eraFrom = fields.eraFrom.value;
    data.centuryTo = numOrNull(fields.centuryTo.value);
    data.eraTo = fields.eraTo.value;
  } else {
    data.year = numOrNull(fields.year.value);
    data.month = numOrNull(fields.month.value);
    data.day = numOrNull(fields.day.value);
  }

  if (!data.title) return;

  if (fields.id.value) {
    const index = topics.findIndex(t => t.id === fields.id.value);
    if (index !== -1) {
      topics[index] = { ...topics[index], ...data };
    }
  } else {
    topics.push({
      id: crypto.randomUUID(),
      ...data
    });
  }

  save();
  updateCategoryFilter();
  render();
  closeModal();
  form.reset();
});

document.getElementById("deleteBtn").addEventListener("click", () => {
  const id = fields.id.value;
  if (!id) return;

  if (confirm("¿Quieres eliminar este tema?")) {
    topics = topics.filter(t => t.id !== id);
    save();
    updateCategoryFilter();
    render();
    closeModal();
  }
});

document.getElementById("addBtn").addEventListener("click", () => openModal());
document.getElementById("emptyAddBtn").addEventListener("click", () => openModal());
document.getElementById("closeModal").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);

modal.addEventListener("click", event => {
  if (event.target === modal) closeModal();
});

fields.dateType.addEventListener("change", updateDateFieldsVisibility);

timeline.addEventListener("click", event => {
  const button = event.target.closest("[data-edit]");
  if (!button) return;

  const topic = topics.find(t => t.id === button.dataset.edit);
  if (topic) openModal(topic);
});

summaryList.addEventListener("click", event => {
  const button = event.target.closest("[data-edit]");
  if (!button) return;

  const topic = topics.find(t => t.id === button.dataset.edit);
  if (topic) openModal(topic);
});

document.getElementById("searchInput").addEventListener("input", render);
document.getElementById("categoryFilter").addEventListener("change", render);

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(topics, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "study-timeline.json";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (!Array.isArray(imported)) throw new Error();

      topics = migrateTopics(imported).map(topic => ({
        id: topic.id || crypto.randomUUID(),
        title: String(topic.title || "Sin título"),
        dateType: ["exact", "century", "yearRange", "centuryRange"].includes(topic.dateType)
          ? topic.dateType
          : "exact",
        year: numOrNull(topic.year),
        month: numOrNull(topic.month),
        day: numOrNull(topic.day),
        century: numOrNull(topic.century),
        era: topic.era === "AC" ? "AC" : "DC",
        yearFrom: numOrNull(topic.yearFrom),
        yearTo: numOrNull(topic.yearTo),
        centuryFrom: numOrNull(topic.centuryFrom),
        eraFrom: topic.eraFrom === "DC" ? "DC" : "AC",
        centuryTo: numOrNull(topic.centuryTo),
        eraTo: topic.eraTo === "AC" ? "AC" : "DC",
        category: String(topic.category || ""),
        description: String(topic.description || ""),
        status: ["pending", "progress", "done"].includes(topic.status)
          ? topic.status
          : "pending",
        color: topic.color || "#7c5cff",
        progress: Math.min(100, Math.max(0, Number(topic.progress) || 0))
      }));

      save();
      updateCategoryFilter();
      render();
    } catch {
      alert("El archivo no contiene un timeline válido.");
    }
  };

  reader.readAsText(file);
  event.target.value = "";
});

updateCategoryFilter();
render();