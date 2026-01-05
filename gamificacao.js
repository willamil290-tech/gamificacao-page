/* Gamificação Devalor — cálculo automático + persistência local (localStorage)
   Funciona em site estático (GitHub Pages, etc.)
*/
(function () {
  "use strict";

  function $(id) { return document.getElementById(id); }

  function safeParse(jsonStr) {
    try { return JSON.parse(jsonStr); } catch (e) { return null; }
  }

  function pad2(n) { return String(n).padStart(2, "0"); }

  function formatDateTime(dt) {
    // dd/mm/yyyy hh:mm
    return pad2(dt.getDate()) + "/" + pad2(dt.getMonth() + 1) + "/" + dt.getFullYear() +
      " " + pad2(dt.getHours()) + ":" + pad2(dt.getMinutes());
  }

  function normalizeNumber(value) {
    var n = Number(value);
    if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    return Math.floor(n);
  }

  function buildDefaultState(config) {
    var state = { updatedAt: null, people: {} };
    config.people.forEach(function (p) {
      state.people[p.id] = {};
      config.metrics.forEach(function (m) {
        state.people[p.id][m.key] = (m.type === "checkbox") ? false : 0;
      });
    });
    return state;
  }

  function mergeState(defaultState, loaded) {
    if (!loaded || typeof loaded !== "object") return defaultState;

    var merged = JSON.parse(JSON.stringify(defaultState));
    if (loaded.updatedAt) merged.updatedAt = loaded.updatedAt;

    if (loaded.people && typeof loaded.people === "object") {
      Object.keys(merged.people).forEach(function (personId) {
        var src = loaded.people[personId];
        if (!src || typeof src !== "object") return;

        Object.keys(merged.people[personId]).forEach(function (metricKey) {
          if (metricKey in src) merged.people[personId][metricKey] = src[metricKey];
        });
      });
    }

    return merged;
  }

  function computePoints(config, personMetrics) {
    var total = 0;
    config.metrics.forEach(function (m) {
      var raw = personMetrics[m.key];
      var val = (m.type === "checkbox") ? (raw ? 1 : 0) : normalizeNumber(raw);
      total += val * (m.points || 0);
    });
    return total;
  }

  function computeAll(config, state) {
    var computed = [];
    config.people.forEach(function (p) {
      var metrics = state.people[p.id] || {};
      var pontos = computePoints(config, metrics);
      computed.push({ id: p.id, nome: p.nome, pontos: pontos });
    });
    computed.sort(function (a, b) { return b.pontos - a.pontos; });
    return computed;
  }

  function renderRanking(config, state) {
    var tbody = $("tabela-ranking");
    if (!tbody) return;
    tbody.innerHTML = "";

    var ranking = computeAll(config, state);
    ranking.forEach(function (item, index) {
      var row = tbody.insertRow();
      row.insertCell(0).textContent = String(index + 1);
      row.insertCell(1).textContent = item.nome;
      row.insertCell(2).textContent = String(item.pontos);
    });
  }

  function renderHighlights(config, state) {
    var ranking = computeAll(config, state);

    var ids = [
      "primeiro-destaque",
      "segundo-destaque",
      "terceiro-destaque",
      "quarto-destaque",
      "quinto-destaque"
    ];

    var medals = ["🥇", "🥈", "🥉", "4º", "5º"];

    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (!el) continue;

      if (ranking[i]) {
        var prefix = medals[i] || (String(i + 1) + "º");
        el.textContent = prefix + " " + ranking[i].nome + " — " + ranking[i].pontos + " pontos";
        el.style.display = "";
      } else {
        el.textContent = "";
        el.style.display = "none";
      }
    }
  }

  function renderPremios(premios, listId) {
    var ul = $(listId);
    if (!ul) return;
    ul.innerHTML = "";

    (premios || []).forEach(function (p) {
      var li = document.createElement("li");
      li.textContent = p.nome;
      ul.appendChild(li);
    });
  }

  function setSaveStatus(state, statusId) {
    var el = $(statusId);
    if (!el) return;

    if (!state.updatedAt) {
      el.textContent = "Sem alterações salvas ainda.";
      return;
    }

    el.textContent = "Salvo em " + state.updatedAt;
  }

  function saveState(config, state) {
    state.updatedAt = formatDateTime(new Date());
    try {
      localStorage.setItem(config.storageKey, JSON.stringify(state));
    } catch (e) {
      // Se localStorage estiver indisponível, não quebra o site.
      console.warn("Não foi possível salvar no localStorage:", e);
    }
    setSaveStatus(state, config.statusId || "status-salvamento");
  }

  function renderFormula(config) {
    var ul = $("lista-formula");
    if (!ul) return;

    ul.innerHTML = "";
    config.metrics.forEach(function (m) {
      var li = document.createElement("li");
      if (m.type === "checkbox") {
        li.textContent = m.label + ": +" + m.points + " ponto" + (m.points > 1 ? "s" : "") + " (se marcado)";
      } else {
        li.textContent = m.label + ": " + m.points + " ponto" + (m.points > 1 ? "s" : "") + " por unidade";
      }
      ul.appendChild(li);
    });
  }

  function buildLancamentoTable(config, state) {
    var table = $("tabela-lancamento");
    if (!table) return;

    table.innerHTML = "";

    // Header
    var thead = document.createElement("thead");
    var hrow = document.createElement("tr");

    var thNome = document.createElement("th");
    thNome.textContent = "Pessoa";
    hrow.appendChild(thNome);

    config.metrics.forEach(function (m) {
      var th = document.createElement("th");
      th.innerHTML = m.label + "<br><small>(" + (m.type === "checkbox" ? ("+" + m.points) : (m.points + "/un")) + ")</small>";
      hrow.appendChild(th);
    });

    var thTotal = document.createElement("th");
    thTotal.textContent = "Total (pontos)";
    hrow.appendChild(thTotal);

    thead.appendChild(hrow);
    table.appendChild(thead);

    // Body
    var tbody = document.createElement("tbody");

    config.people.forEach(function (p) {
      var row = document.createElement("tr");

      var tdNome = document.createElement("td");
      tdNome.textContent = p.nome;
      tdNome.className = "td-nome";
      row.appendChild(tdNome);

      config.metrics.forEach(function (m) {
        var td = document.createElement("td");
        td.className = "td-input";

        var input = document.createElement("input");
        input.setAttribute("data-person", p.id);
        input.setAttribute("data-metric", m.key);

        if (m.type === "checkbox") {
          input.type = "checkbox";
          input.checked = !!(state.people[p.id] && state.people[p.id][m.key]);
          input.className = "chk";
        } else {
          input.type = "number";
          input.min = "0";
          input.step = "1";
          input.inputMode = "numeric";
          input.value = String(normalizeNumber(state.people[p.id] && state.people[p.id][m.key]));
          input.className = "num";
        }

        td.appendChild(input);
        row.appendChild(td);
      });

      var tdTotal = document.createElement("td");
      tdTotal.id = "total-" + p.id;
      tdTotal.className = "td-total";
      tdTotal.textContent = String(computePoints(config, state.people[p.id] || {}));
      row.appendChild(tdTotal);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);

    // Eventos
    function onAnyChange(ev) {
      var target = ev.target;
      if (!target || !target.getAttribute) return;
      var personId = target.getAttribute("data-person");
      var metricKey = target.getAttribute("data-metric");
      if (!personId || !metricKey) return;

      if (!state.people[personId]) state.people[personId] = {};
      var metric = null;
      for (var i = 0; i < config.metrics.length; i++) {
        if (config.metrics[i].key === metricKey) { metric = config.metrics[i]; break; }
      }
      if (!metric) return;

      if (metric.type === "checkbox") {
        state.people[personId][metricKey] = !!target.checked;
      } else {
        var val = normalizeNumber(target.value);
        state.people[personId][metricKey] = val;
        // Normaliza visualmente (remove decimais/negativos)
        if (String(val) !== String(target.value)) target.value = String(val);
      }

      // Atualiza total da linha
      var totalCell = $("total-" + personId);
      if (totalCell) totalCell.textContent = String(computePoints(config, state.people[personId]));

      // Atualiza ranking e destaques
      renderRanking(config, state);
      renderHighlights(config, state);

      // Salva
      saveState(config, state);
    }

    // Listener no table (delegação)
    table.addEventListener("input", onAnyChange);
    table.addEventListener("change", onAnyChange);
  }

  function wireButtons(config, state) {
    var btnReset = $(config.resetButtonId || "resetar-dados");
    if (btnReset) {
      btnReset.addEventListener("click", function () {
        var ok = confirm("Tem certeza que deseja zerar os números deste ranking? (isso apaga os dados salvos neste navegador)");
        if (!ok) return;
        var fresh = buildDefaultState(config);
        state.updatedAt = fresh.updatedAt;
        state.people = fresh.people;
        buildLancamentoTable(config, state);
        renderRanking(config, state);
        renderHighlights(config, state);
        saveState(config, state);
      });
    }

    var btnExport = $(config.exportButtonId || "exportar-json");
    if (btnExport) {
      btnExport.addEventListener("click", function () {
        try {
          var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url;
          a.download = (config.storageKey || "gamificacao") + ".json";
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        } catch (e) {
          alert("Não foi possível exportar agora.");
        }
      });
    }

    var inputImport = $(config.importInputId || "importar-json");
    if (inputImport) {
      inputImport.addEventListener("change", function (ev) {
        var file = ev.target.files && ev.target.files[0];
        if (!file) return;

        var reader = new FileReader();
        reader.onload = function () {
          var loaded = safeParse(reader.result);
          if (!loaded) {
            alert("Arquivo inválido.");
            inputImport.value = "";
            return;
          }

          // Mescla com defaults para garantir métricas novas
          var merged = mergeState(buildDefaultState(config), loaded);
          state.updatedAt = merged.updatedAt;
          state.people = merged.people;

          buildLancamentoTable(config, state);
          renderRanking(config, state);
          renderHighlights(config, state);
          saveState(config, state);

          inputImport.value = "";
        };
        reader.readAsText(file);
      });
    }
  }

  function init(config) {
    if (!config || !config.storageKey) {
      console.error("Config inválida: storageKey é obrigatório.");
      return;
    }

    var defaults = buildDefaultState(config);
    var loaded = safeParse(localStorage.getItem(config.storageKey) || "");
    var state = mergeState(defaults, loaded);

    buildLancamentoTable(config, state);
    renderRanking(config, state);
    renderHighlights(config, state);
    renderFormula(config);
    setSaveStatus(state, config.statusId || "status-salvamento");
    wireButtons(config, state);

    // Retorna helpers se precisar usar no page script
    return {
      state: state,
      renderPremios: renderPremios
    };
  }

  window.Gamificacao = {
    init: init,
    renderPremios: renderPremios
  };
})();
