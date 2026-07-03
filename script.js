"use strict";

/* =====================================================================
   PARÂMETROS OFICIAIS: edite aqui ou pela aba "Tabelas e parâmetros".
   Fontes na aba "Fontes oficiais". Vigência: 01/01/2026.
   ===================================================================== */
const DEFAULT_PARAMS = {
  year: "2026",
  minimumWage: 1621.00,            // Decreto nº 12.797/2025
  inss: {                          // Portaria Interministerial MPS/MF nº 13/2026
    ceiling: 8475.55,
    brackets: [
      { upTo: 1621.00, rate: 7.5 },
      { upTo: 2902.84, rate: 9.0 },
      { upTo: 4354.27, rate: 12.0 },
      { upTo: 8475.55, rate: 14.0 }
    ]
  },
  irrf: {                          // Receita Federal, tabela mensal 2026
    brackets: [
      { upTo: 2428.80, rate: 0,    deduction: 0 },
      { upTo: 2826.65, rate: 7.5,  deduction: 182.16 },
      { upTo: 3751.05, rate: 15.0, deduction: 394.16 },
      { upTo: 4664.68, rate: 22.5, deduction: 675.49 },
      { upTo: null,    rate: 27.5, deduction: 908.73 }
    ],
    dependentDeduction: 189.59,
    simplifiedDeduction: 607.20,
    reduction: {                   // Lei nº 15.270/2025 (art. 3º-A da Lei 9.250/1995)
      exemptLimit: 5000.00,
      upperLimit: 7350.00,
      constant: 978.62,
      coefficient: 0.133145
    }
  },
  familyAllowance: { quota: 67.54, incomeLimit: 1980.38 }, // Portaria MPS/MF nº 13/2026
  fgtsRate: 8                                              // Lei nº 8.036/1990
};

const PARAMS_STORAGE_KEY = "net-salary-calc:params:v1";
const FORM_STORAGE_KEY = "net-salary-calc:form:v1";
const THEME_STORAGE_KEY = "net-salary-calc:theme";

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/* ===================== utilitários ===================== */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function formatNumber(value) {
  return (isFinite(value) ? value : 0)
    .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatCurrency(value) { return "R$ " + formatNumber(value); }
function formatPercent(value) {
  return (isFinite(value) ? value : 0)
    .toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
}

/* Aceita "3.500,00", "3500.50", "R$ 1.234"; retorna 0 para entrada inválida. */
function parseCurrency(raw) {
  if (raw == null) return 0;
  let text = String(raw).replace(/R\$|\s/g, "").trim();
  if (!text) return 0;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  const value = parseFloat(text);
  return isFinite(value) && value > 0 ? value : 0;
}

/* Aceita "49:15", "49h15" (horas e minutos) ou "49,25" (decimal). */
function parseHours(raw) {
  if (raw == null) return 0;
  const text = String(raw).trim().toLowerCase();
  if (!text) return 0;
  const match = text.match(/^(\d+)\s*[:h]\s*([0-5]?\d)?\s*(?:m(?:in)?)?$/);
  if (match) return parseInt(match[1], 10) + (match[2] ? parseInt(match[2], 10) / 60 : 0);
  const value = parseFloat(text.replace(",", "."));
  return isFinite(value) && value > 0 ? value : 0;
}

function formatHoursLabel(decimalHours) {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return minutes ? `${hours}h${String(minutes).padStart(2, "0")}` : `${hours}h`;
}

/* ===================== calendário nacional (DSR) ===================== */
/* Algoritmo de Meeus para a Páscoa no calendário gregoriano. */
function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100,
    d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31),
    day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/* Feriados nacionais fixos (Leis 662/1949, 6.802/1980, 14.759/2023) + Sexta-feira Santa. */
function nationalHolidays(year) {
  const fixed = [[0, 1], [3, 21], [4, 1], [8, 7], [9, 12], [10, 2], [10, 15], [10, 20], [11, 25]]
    .map(([month, day]) => new Date(year, month, day));
  const easter = easterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  return fixed.concat([goodFriday]);
}

/* Para o DSR: dias úteis incluem sábados; descansos = domingos + feriados fora de domingo. */
function monthCalendar(year, month) { // month: 1..12
  const totalDays = new Date(year, month, 0).getDate();
  let sundays = 0;
  for (let day = 1; day <= totalDays; day++) {
    if (new Date(year, month - 1, day).getDay() === 0) sundays++;
  }
  const holidays = nationalHolidays(year)
    .filter(date => date.getMonth() === month - 1 && date.getDay() !== 0).length;
  return {
    totalDays, sundays, holidays,
    businessDays: totalDays - sundays - holidays,
    restDays: sundays + holidays
  };
}

/* ===================== motor de cálculo (funções puras) ===================== */
function computeInss(base, params) {
  const ceiling = params.inss.ceiling;
  const cappedBase = Math.max(0, Math.min(base, ceiling));
  let previousLimit = 0, total = 0;
  const steps = [];
  for (const bracket of params.inss.brackets) {
    const limit = bracket.upTo == null ? cappedBase : Math.min(cappedBase, bracket.upTo);
    if (limit > previousLimit) {
      const slice = limit - previousLimit;
      const amount = slice * bracket.rate / 100;
      total += amount;
      steps.push({ from: previousLimit, to: limit, rate: bracket.rate, amount });
    }
    if (bracket.upTo != null) {
      previousLimit = bracket.upTo;
      if (cappedBase <= bracket.upTo) break;
    }
  }
  return { total: round2(total), steps, capped: base > ceiling, ceiling };
}

function taxFromTable(base, brackets) {
  if (base <= 0) return 0;
  for (const bracket of brackets) {
    if (bracket.upTo == null || base <= bracket.upTo) {
      return Math.max(0, base * bracket.rate / 100 - bracket.deduction);
    }
  }
  const last = brackets[brackets.length - 1];
  return Math.max(0, base * last.rate / 100 - last.deduction);
}

/* IRRF mensal: compara deduções legais vs. desconto simplificado (usa o menor
   imposto, como manda a IN RFB) e aplica o redutor da Lei 15.270/2025. */
function computeIrrf(taxableIncome, legalDeductions, params) {
  const table = params.irrf;
  const legalBase = Math.max(0, taxableIncome - legalDeductions);
  const simplifiedBase = Math.max(0, taxableIncome - table.simplifiedDeduction);
  const legalTax = taxFromTable(legalBase, table.brackets);
  const simplifiedTax = taxFromTable(simplifiedBase, table.brackets);
  const useSimplified = simplifiedTax < legalTax;
  const tax = useSimplified ? simplifiedTax : legalTax;

  const rule = table.reduction;
  let reduction = 0;
  if (taxableIncome <= rule.exemptLimit) reduction = tax;
  else if (taxableIncome <= rule.upperLimit) {
    reduction = Math.min(tax, Math.max(0, rule.constant - rule.coefficient * taxableIncome));
  }

  return {
    total: round2(Math.max(0, tax - reduction)),
    taxableIncome, legalDeductions, legalBase, simplifiedBase,
    legalTax: round2(legalTax), simplifiedTax: round2(simplifiedTax),
    method: useSimplified ? "simplified" : "legal",
    reduction: round2(reduction)
  };
}

/* Entrada do formulário -> resultado completo da folha (função pura, sem DOM). */
function computePayroll(input, params) {
  const schedule = input.schedule > 0 ? input.schedule : 220;
  const hazardAmount = input.hazardPay ? input.baseSalary * 0.30 : 0;
  const unhealthyBase = input.unhealthy.base === "base-salary" ? input.baseSalary : params.minimumWage;
  const unhealthyAmount = unhealthyBase * input.unhealthy.level / 100;
  const hourlyRate = (input.baseSalary + hazardAmount + unhealthyAmount) / schedule;

  const earnings = [];
  const deductions = [];
  const addEarning = (label, ref, amount, bases) => {
    if (amount > 0.004) earnings.push({ label, ref, amount: round2(amount), ...bases });
  };
  const addDeduction = (label, ref, amount) => {
    if (amount > 0.004) deductions.push({ label, ref, amount: round2(amount) });
  };
  const ALL_BASES = { inss: true, irrf: true, fgts: true };

  addEarning("Salário base", formatHoursLabel(schedule), input.baseSalary, ALL_BASES);
  addEarning("Adicional de periculosidade", "30%", hazardAmount, ALL_BASES);
  addEarning(`Adicional de insalubridade (${input.unhealthy.level}%)`,
    input.unhealthy.base === "base-salary" ? "sal. base" : "sal. mín.", unhealthyAmount, ALL_BASES);

  let variablePayTotal = 0;
  const overtimeRows = [
    { label: "Horas extras 50%", hours: input.overtime50, factor: 1.5 },
    { label: "Horas extras 100%", hours: input.overtime100, factor: 2.0 },
    { label: `Horas extras ${input.extraRate}%`, hours: input.extraRate > 0 ? input.extraHours : 0, factor: 1 + input.extraRate / 100 }
  ];
  for (const row of overtimeRows) {
    if (row.hours > 0) {
      const amount = hourlyRate * row.factor * row.hours;
      variablePayTotal += amount;
      addEarning(row.label, formatHoursLabel(row.hours), amount, ALL_BASES);
    }
  }

  let nightAmount = 0;
  if (input.night.hours > 0 && input.night.rate > 0) {
    // Hora noturna reduzida: 52min30s contam como 1h (fator 60/52,5).
    const effectiveHours = input.night.hours * (input.night.reduced ? 60 / 52.5 : 1);
    nightAmount = hourlyRate * (input.night.rate / 100) * effectiveHours;
    variablePayTotal += nightAmount;
    addEarning(`Adicional noturno (${input.night.rate}%)`, formatHoursLabel(effectiveHours), nightAmount, ALL_BASES);
  }

  let dsrAmount = 0;
  if (input.dsr.enabled && variablePayTotal > 0 && input.dsr.businessDays > 0) {
    dsrAmount = variablePayTotal / input.dsr.businessDays * input.dsr.restDays;
    addEarning("DSR sobre verbas variáveis", `${input.dsr.restDays}/${input.dsr.businessDays}`, dsrAmount, ALL_BASES);
  }

  for (const item of input.otherEarnings) {
    if (item.amount > 0) {
      addEarning(item.label || "Outros proventos", "", item.amount,
        { inss: item.inss, irrf: item.irrf, fgts: item.fgts });
    }
  }

  // Faltas e DSRs perdidos reduzem a remuneração e, portanto, as bases.
  const dayValue = input.baseSalary / 30;
  const absenceAmount = dayValue * input.absenceDays;
  const lostRestAmount = dayValue * input.lostRestDays;
  addDeduction("Faltas", `${input.absenceDays}d`, absenceAmount);
  addDeduction("DSR perdido", `${input.lostRestDays}d`, lostRestAmount);
  const baseReduction = absenceAmount + lostRestAmount;

  const sumBase = (flag) => earnings.reduce((sum, item) => sum + (item[flag] ? item.amount : 0), 0);
  const inssBase = Math.max(0, round2(sumBase("inss") - baseReduction));
  const irrfBase = Math.max(0, round2(sumBase("irrf") - baseReduction));
  const fgtsBase = Math.max(0, round2(sumBase("fgts") - baseReduction));

  // Salário-família: benefício previdenciário, não integra nenhuma base.
  let familyAmount = 0;
  const familyEligible = inssBase <= params.familyAllowance.incomeLimit;
  if (input.familyChildren > 0 && familyEligible) {
    familyAmount = params.familyAllowance.quota * input.familyChildren;
    addEarning("Salário-família", `${input.familyChildren}×`, familyAmount,
      { inss: false, irrf: false, fgts: false });
  }

  const inss = computeInss(inssBase, params);
  addDeduction("INSS", formatPercent(inssBase > 0 ? inss.total / inssBase * 100 : 0), inss.total);

  const alimonyAmount = input.alimony.mode === "percent"
    ? irrfBase * input.alimony.value / 100
    : input.alimony.value;
  const legalDeductions = inss.total + input.irDependents * params.irrf.dependentDeduction
    + alimonyAmount + input.privatePension;
  const irrf = computeIrrf(irrfBase, legalDeductions, params);
  addDeduction("IRRF", irrf.total > 0
    ? formatPercent(irrf.taxableIncome > 0 ? irrf.total / irrf.taxableIncome * 100 : 0)
    : "isento", irrf.total);

  addDeduction("Pensão alimentícia",
    input.alimony.mode === "percent" ? formatPercent(input.alimony.value) : "", alimonyAmount);
  addDeduction("Previdência complementar", "", input.privatePension);

  let transportAmount = 0;
  if (input.transport.enabled) {
    const sixPercent = input.baseSalary * 0.06;
    transportAmount = input.transport.cost > 0 ? Math.min(sixPercent, input.transport.cost) : sixPercent;
    addDeduction("Vale-transporte", "6%", transportAmount);
  }
  addDeduction("Coparticipação VR/VA", "", input.mealDiscount);
  addDeduction("Plano de saúde/odonto", "", input.healthPlan);

  const advanceAmount = input.advance.mode === "percent"
    ? input.baseSalary * input.advance.value / 100
    : input.advance.value;
  addDeduction("Adiantamento salarial",
    input.advance.mode === "percent" ? formatPercent(input.advance.value) : "", advanceAmount);

  for (const item of input.otherDeductions) {
    if (item.amount > 0) addDeduction(item.label || "Outros descontos", "", item.amount);
  }

  const totalEarnings = round2(earnings.reduce((sum, item) => sum + item.amount, 0));
  const totalDeductions = round2(deductions.reduce((sum, item) => sum + item.amount, 0));
  const fgtsAmount = round2(fgtsBase * params.fgtsRate / 100);

  return {
    earnings, deductions,
    totalEarnings, totalDeductions,
    netSalary: round2(totalEarnings - totalDeductions),
    inssBase, irrfBase, fgtsBase,
    inss, irrf, fgtsAmount,
    hourlyRate: round2(hourlyRate),
    dsrAmount: round2(dsrAmount),
    variablePayTotal: round2(variablePayTotal),
    alimonyAmount: round2(alimonyAmount),
    transportAmount: round2(transportAmount),
    familyAmount: round2(familyAmount),
    familyEligible
  };
}

/* ===================== leitura do formulário ===================== */
function readForm() {
  return {
    baseSalary: parseCurrency($("#base-salary").value),
    schedule: $("#work-schedule").value === "custom"
      ? (parseFloat($("#custom-schedule").value) || 220)
      : parseFloat($("#work-schedule").value),
    overtime50: parseHours($("#overtime-50").value),
    overtime100: parseHours($("#overtime-100").value),
    extraHours: parseHours($("#extra-hours").value),
    extraRate: Math.max(0, parseFloat($("#extra-rate").value) || 0),
    dsr: {
      enabled: $("#dsr-enabled").checked,
      businessDays: parseInt($("#business-days").value, 10) || 0,
      restDays: parseInt($("#rest-days").value, 10) || 0
    },
    night: {
      hours: parseHours($("#night-hours").value),
      rate: Math.max(0, parseFloat($("#night-rate").value) || 0),
      reduced: $("#night-reduced").checked
    },
    hazardPay: $("#hazard-pay").checked,
    unhealthy: {
      level: parseFloat($("#unhealthy-level").value) || 0,
      base: $("#unhealthy-base").value
    },
    irDependents: Math.max(0, parseInt($("#ir-dependents").value, 10) || 0),
    familyChildren: Math.max(0, parseInt($("#family-children").value, 10) || 0),
    alimony: { mode: $("#alimony-mode").value, value: parseCurrency($("#alimony-value").value) },
    privatePension: parseCurrency($("#private-pension").value),
    transport: { enabled: $("#transport-enabled").checked, cost: parseCurrency($("#transport-cost").value) },
    mealDiscount: parseCurrency($("#meal-discount").value),
    healthPlan: parseCurrency($("#health-plan").value),
    advance: {
      mode: $("#advance-mode").value,
      value: $("#advance-mode").value === "percent"
        ? (parseFloat($("#advance-value").value.replace(",", ".")) || 0)
        : parseCurrency($("#advance-value").value)
    },
    absenceDays: Math.max(0, parseInt($("#absence-days").value, 10) || 0),
    lostRestDays: Math.max(0, parseInt($("#lost-rest-days").value, 10) || 0),
    otherEarnings: readDynamicItems("#earnings-list", true),
    otherDeductions: readDynamicItems("#deductions-list", false)
  };
}

function readDynamicItems(listSelector, withFlags) {
  return $$(listSelector + " .dynamic-item").map(element => {
    const item = {
      label: element.querySelector(".item-label").value.trim(),
      amount: parseCurrency(element.querySelector(".item-amount").value)
    };
    if (withFlags) {
      item.inss = element.querySelector(".item-inss").checked;
      item.irrf = element.querySelector(".item-irrf").checked;
      item.fgts = element.querySelector(".item-fgts").checked;
    }
    return item;
  });
}

/* ===================== renderização do resultado ===================== */
function renderResult() {
  const input = readForm();
  const [year, month] = ($("#reference-month").value || "2026-01").split("-").map(Number);
  $("#paycheck-month").textContent = `${MONTH_NAMES[(month || 1) - 1]}/${year || ""}`;

  if (input.baseSalary <= 0) {
    $("#paycheck-body").innerHTML =
      `<tr><td colspan="4" class="empty-state">Informe o salário base para começar.</td></tr>`;
    $("#total-earnings").textContent = "…";
    $("#total-deductions").textContent = "…";
    setNetSalary($("#net-salary"), 0);
    $("#net-salary-mini").textContent = "R$ 0,00";
    ["#inss-rate", "#irrf-rate", "#deductions-rate", "#fgts-amount"].forEach(id => { $(id).textContent = "…"; });
    $("#calc-memo").innerHTML = "";
    return;
  }

  const result = computePayroll(input, activeParams);
  const escapeHtml = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  let rowsHtml = "";
  for (const item of result.earnings) {
    rowsHtml += `<tr><td>${escapeHtml(item.label)}</td><td class="col-ref">${escapeHtml(item.ref)}</td>` +
      `<td class="col-num earning">${formatNumber(item.amount)}</td><td class="col-num"></td></tr>`;
  }
  for (const item of result.deductions) {
    rowsHtml += `<tr><td>${escapeHtml(item.label)}</td><td class="col-ref">${escapeHtml(item.ref)}</td>` +
      `<td class="col-num"></td><td class="col-num deduction">${formatNumber(item.amount)}</td></tr>`;
  }
  $("#paycheck-body").innerHTML = rowsHtml;

  $("#total-earnings").textContent = formatNumber(result.totalEarnings);
  $("#total-deductions").textContent = formatNumber(result.totalDeductions);
  setNetSalary($("#net-salary"), result.netSalary);
  $("#net-salary-mini").textContent = formatCurrency(result.netSalary);
  $("#inss-rate").textContent = result.inssBase > 0 ? formatPercent(result.inss.total / result.inssBase * 100) : "0%";
  $("#irrf-rate").textContent = result.irrfBase > 0 ? formatPercent(result.irrf.total / result.irrfBase * 100) : "0%";
  $("#deductions-rate").textContent = result.totalEarnings > 0
    ? formatPercent(result.totalDeductions / result.totalEarnings * 100) : "0%";
  $("#fgts-amount").textContent = formatCurrency(result.fgtsAmount);

  renderCalcMemo(input, result);
}

function renderCalcMemo(input, result) {
  let html = "";

  html += `<h3>Valor-hora</h3>
    <p class="formula">(salário ${formatNumber(input.baseSalary)} + adicionais fixos) ÷ ${input.schedule} h = R$ ${formatNumber(result.hourlyRate)}/h</p>`;

  if (result.variablePayTotal > 0 && input.dsr.enabled && input.dsr.businessDays > 0) {
    html += `<h3>DSR (Lei 605/1949)</h3>
      <p class="formula">R$ ${formatNumber(result.variablePayTotal)} ÷ ${input.dsr.businessDays} dias úteis × ${input.dsr.restDays} descansos = R$ ${formatNumber(result.dsrAmount)}</p>`;
  }

  html += `<h3>INSS sobre base de R$ ${formatNumber(result.inssBase)}${result.inss.capped ? ` (limitada ao teto de R$ ${formatNumber(result.inss.ceiling)})` : ""}</h3><table>`;
  for (const step of result.inss.steps) {
    html += `<tr><td>${formatNumber(step.from)} a ${formatNumber(step.to)}</td>` +
      `<td>× ${step.rate.toLocaleString("pt-BR")}%</td><td>${formatNumber(step.amount)}</td></tr>`;
  }
  html += `<tr><td colspan="2"><b>Total INSS</b></td><td><b>${formatNumber(result.inss.total)}</b></td></tr></table>`;

  const irrf = result.irrf;
  const chosen = (method) => irrf.method === method ? "chosen" : "";
  html += `<h3>IRRF sobre rendimento tributável de R$ ${formatNumber(irrf.taxableIncome)}</h3>
    <p>Deduções legais (INSS + dependentes + pensão + PGBL) = R$ ${formatNumber(irrf.legalDeductions)} → base R$ ${formatNumber(irrf.legalBase)} → imposto <span class="${chosen("legal")}">R$ ${formatNumber(irrf.legalTax)}</span></p>
    <p>Desconto simplificado (R$ ${formatNumber(activeParams.irrf.simplifiedDeduction)}) → base R$ ${formatNumber(irrf.simplifiedBase)} → imposto <span class="${chosen("simplified")}">R$ ${formatNumber(irrf.simplifiedTax)}</span></p>
    <p>Método aplicado: <b>${irrf.method === "simplified" ? "desconto simplificado" : "deduções legais"}</b> (o mais vantajoso).</p>`;
  const rule = activeParams.irrf.reduction;
  if (irrf.taxableIncome <= rule.exemptLimit) {
    html += `<p>Redutor (Lei 15.270/2025): rendimento até R$ ${formatNumber(rule.exemptLimit)} → <b>imposto zerado</b> (redução de R$ ${formatNumber(irrf.reduction)}).</p>`;
  } else if (irrf.taxableIncome <= rule.upperLimit) {
    html += `<p>Redutor (Lei 15.270/2025):</p><p class="formula">${formatNumber(rule.constant)} - (${String(rule.coefficient).replace(".", ",")} × ${formatNumber(irrf.taxableIncome)}) = R$ ${formatNumber(rule.constant - rule.coefficient * irrf.taxableIncome)} → redução aplicada R$ ${formatNumber(irrf.reduction)}</p>`;
  } else {
    html += `<p>Redutor (Lei 15.270/2025): rendimento acima de R$ ${formatNumber(rule.upperLimit)} → sem redução.</p>`;
  }
  html += `<p><b>IRRF final: R$ ${formatNumber(irrf.total)}</b></p>`;

  if (input.familyChildren > 0) {
    html += `<h3>Salário-família</h3><p>${result.familyEligible
      ? `Remuneração R$ ${formatNumber(result.inssBase)} dentro do limite de R$ ${formatNumber(activeParams.familyAllowance.incomeLimit)} → ${input.familyChildren} × R$ ${formatNumber(activeParams.familyAllowance.quota)} = <b>R$ ${formatNumber(result.familyAmount)}</b>`
      : `Remuneração R$ ${formatNumber(result.inssBase)} acima do limite de R$ ${formatNumber(activeParams.familyAllowance.incomeLimit)} → sem direito no mês.`}</p>`;
  }

  html += `<h3>FGTS (depósito do empregador)</h3>
    <p class="formula">R$ ${formatNumber(result.fgtsBase)} × ${activeParams.fgtsRate.toLocaleString("pt-BR")}% = R$ ${formatNumber(result.fgtsAmount)}</p>`;

  $("#calc-memo").innerHTML = html;
}

/* ===================== itens dinâmicos ===================== */
function addDynamicItem(listSelector, withFlags, saved) {
  const element = document.createElement("div");
  element.className = "dynamic-item";
  element.innerHTML = `
    <input type="text" class="item-label" placeholder="descrição" aria-label="Descrição do item">
    <div class="money-field">
      <span class="money-affix" aria-hidden="true">R$</span>
      <input type="text" class="item-amount money-input" inputmode="decimal" placeholder="0,00" aria-label="Valor do item">
    </div>
    <button type="button" class="btn btn-small btn-danger remove-item">remover</button>
    ${withFlags ? `<span class="item-flags"><span>Incide sobre</span>
      <label><input type="checkbox" class="item-inss" checked> INSS</label>
      <label><input type="checkbox" class="item-irrf" checked> IRRF</label>
      <label><input type="checkbox" class="item-fgts" checked> FGTS</label>
    </span>` : ""}`;
  if (saved) {
    element.querySelector(".item-label").value = saved.label || "";
    element.querySelector(".item-amount").value = saved.amount || "";
    if (withFlags) {
      element.querySelector(".item-inss").checked = saved.inss !== false;
      element.querySelector(".item-irrf").checked = saved.irrf !== false;
      element.querySelector(".item-fgts").checked = saved.fgts !== false;
    }
  }
  element.querySelector(".remove-item").addEventListener("click", () => {
    element.remove();
    handleChange();
  });
  $(listSelector).appendChild(element);
  enhanceMoneyField(element.querySelector(".item-amount"));
}

/* ===================== persistência do formulário ===================== */
const FORM_FIELDS = ["base-salary", "work-schedule", "custom-schedule", "reference-month",
  "overtime-50", "overtime-100", "extra-hours", "extra-rate",
  "dsr-enabled", "business-days", "rest-days",
  "night-hours", "night-rate", "night-reduced", "hazard-pay", "unhealthy-level", "unhealthy-base",
  "ir-dependents", "family-children", "alimony-value", "alimony-mode", "private-pension",
  "transport-enabled", "transport-cost", "meal-discount", "health-plan",
  "advance-value", "advance-mode", "absence-days", "lost-rest-days"];

function saveFormState() {
  const data = {};
  for (const id of FORM_FIELDS) {
    const element = document.getElementById(id);
    data[id] = element.type === "checkbox" ? element.checked : element.value;
  }
  data._earnings = readRawItems("#earnings-list", true);
  data._deductions = readRawItems("#deductions-list", false);
  try { localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data)); } catch (_) { /* armazenamento indisponível */ }
}

function readRawItems(listSelector, withFlags) {
  return $$(listSelector + " .dynamic-item").map(element => {
    const item = {
      label: element.querySelector(".item-label").value,
      amount: element.querySelector(".item-amount").value
    };
    if (withFlags) {
      item.inss = element.querySelector(".item-inss").checked;
      item.irrf = element.querySelector(".item-irrf").checked;
      item.fgts = element.querySelector(".item-fgts").checked;
    }
    return item;
  });
}

function restoreFormState() {
  let data;
  try { data = JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || "null"); } catch (_) { data = null; }
  if (!data) return false;
  for (const id of FORM_FIELDS) {
    const element = document.getElementById(id);
    if (!(id in data)) continue;
    if (element.type === "checkbox") element.checked = !!data[id];
    else element.value = data[id];
  }
  (data._earnings || []).forEach(item => addDynamicItem("#earnings-list", true, item));
  (data._deductions || []).forEach(item => addDynamicItem("#deductions-list", false, item));
  return true;
}

/* ===================== parâmetros: persistência e aba de edição ===================== */
function loadParams() {
  try {
    const saved = JSON.parse(localStorage.getItem(PARAMS_STORAGE_KEY) || "null");
    if (saved && saved.inss && saved.irrf) return saved;
  } catch (_) { /* usa padrões */ }
  return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
}

function hasCustomParams() {
  return JSON.stringify(activeParams) !== JSON.stringify(DEFAULT_PARAMS);
}

function updateBadges() {
  $("#params-badge").textContent = "Tabelas " + (activeParams.year || "?");
  $("#custom-badge").classList.toggle("hidden", !hasCustomParams());
}

function renderSettings() {
  const inssBody = $("#inss-brackets-body");
  inssBody.innerHTML = "";
  activeParams.inss.brackets.forEach((bracket, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><input data-inss="${index}" data-key="upTo" value="${formatNumber(bracket.upTo)}" aria-label="Faixa ${index + 1} do INSS até"></td>
      <td><input data-inss="${index}" data-key="rate" value="${String(bracket.rate).replace(".", ",")}" aria-label="Alíquota da faixa ${index + 1}"></td>
      <td><button type="button" class="btn btn-small btn-danger" data-remove-inss="${index}" aria-label="Remover faixa ${index + 1} do INSS">×</button></td>`;
    inssBody.appendChild(row);
  });

  const irrfBody = $("#irrf-brackets-body");
  irrfBody.innerHTML = "";
  activeParams.irrf.brackets.forEach((bracket, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td><input data-irrf="${index}" data-key="upTo" value="${bracket.upTo == null ? "" : formatNumber(bracket.upTo)}" placeholder="sem limite" aria-label="Faixa ${index + 1} do IRRF até"></td>
      <td><input data-irrf="${index}" data-key="rate" value="${String(bracket.rate).replace(".", ",")}" aria-label="Alíquota da faixa ${index + 1}"></td>
      <td><input data-irrf="${index}" data-key="deduction" value="${formatNumber(bracket.deduction)}" aria-label="Parcela a deduzir da faixa ${index + 1}"></td>
      <td><button type="button" class="btn btn-small btn-danger" data-remove-irrf="${index}" aria-label="Remover faixa ${index + 1} do IRRF">×</button></td>`;
    irrfBody.appendChild(row);
  });

  $("#params-year").value = activeParams.year || "";
  $("#minimum-wage").value = formatNumber(activeParams.minimumWage);
  $("#dependent-deduction").value = formatNumber(activeParams.irrf.dependentDeduction);
  $("#simplified-deduction").value = formatNumber(activeParams.irrf.simplifiedDeduction);
  $("#reduction-exempt-limit").value = formatNumber(activeParams.irrf.reduction.exemptLimit);
  $("#reduction-upper-limit").value = formatNumber(activeParams.irrf.reduction.upperLimit);
  $("#reduction-constant").value = formatNumber(activeParams.irrf.reduction.constant);
  $("#reduction-rate").value = String(activeParams.irrf.reduction.coefficient).replace(".", ",");
  $("#family-quota").value = formatNumber(activeParams.familyAllowance.quota);
  $("#family-limit").value = formatNumber(activeParams.familyAllowance.incomeLimit);
  $("#fgts-rate-input").value = String(activeParams.fgtsRate).replace(".", ",");

  const maxInss = computeInss(activeParams.inss.ceiling, activeParams).total;
  $("#inss-note").textContent =
    `Teto (última faixa): R$ ${formatNumber(activeParams.inss.ceiling)}; contribuição máxima de R$ ${formatNumber(maxInss)}/mês.`;
}

function showSettingsError(message) {
  const note = $("#settings-error-note");
  note.textContent = message;
  note.classList.remove("hidden");
  setTimeout(() => note.classList.add("hidden"), 5000);
}

function readSettings() {
  const parseCell = (value) => parseCurrency(value);
  const inssBrackets = $$("#inss-brackets-body tr").map(row => ({
    upTo: parseCell(row.querySelector('[data-key="upTo"]').value),
    rate: parseFloat(row.querySelector('[data-key="rate"]').value.replace(",", ".")) || 0
  })).filter(bracket => bracket.upTo > 0).sort((a, b) => a.upTo - b.upTo);

  const irrfBrackets = $$("#irrf-brackets-body tr").map(row => {
    const rawUpTo = row.querySelector('[data-key="upTo"]').value.trim();
    return {
      upTo: rawUpTo === "" ? null : parseCell(rawUpTo),
      rate: parseFloat(row.querySelector('[data-key="rate"]').value.replace(",", ".")) || 0,
      deduction: parseCell(row.querySelector('[data-key="deduction"]').value)
    };
  }).sort((a, b) => (a.upTo == null ? Infinity : a.upTo) - (b.upTo == null ? Infinity : b.upTo));

  if (!inssBrackets.length || !irrfBrackets.length) {
    showSettingsError("As tabelas precisam de ao menos uma faixa válida.");
    return false;
  }

  activeParams = {
    year: $("#params-year").value.trim() || "?",
    minimumWage: parseCell($("#minimum-wage").value),
    inss: { ceiling: inssBrackets[inssBrackets.length - 1].upTo, brackets: inssBrackets },
    irrf: {
      brackets: irrfBrackets,
      dependentDeduction: parseCell($("#dependent-deduction").value),
      simplifiedDeduction: parseCell($("#simplified-deduction").value),
      reduction: {
        exemptLimit: parseCell($("#reduction-exempt-limit").value),
        upperLimit: parseCell($("#reduction-upper-limit").value),
        constant: parseCell($("#reduction-constant").value),
        coefficient: parseFloat($("#reduction-rate").value.replace(",", ".")) || 0
      }
    },
    familyAllowance: {
      quota: parseCell($("#family-quota").value),
      incomeLimit: parseCell($("#family-limit").value)
    },
    fgtsRate: parseFloat($("#fgts-rate-input").value.replace(",", ".")) || 0
  };
  return true;
}

/* ===================== DSR automático ===================== */
let dsrManuallyEdited = false;

function autofillDsr() {
  const [year, month] = ($("#reference-month").value || "").split("-").map(Number);
  if (!year || !month) return;
  const calendar = monthCalendar(year, month);
  if (!dsrManuallyEdited) {
    $("#business-days").value = calendar.businessDays;
    $("#rest-days").value = calendar.restDays;
  }
  $("#holidays-hint").textContent = calendar.holidays > 0
    ? `${calendar.sundays} domingos + ${calendar.holidays} feriado(s) nacional(is); some os locais`
    : `${calendar.sundays} domingos; some feriados locais`;
}

/* ===================== tema claro/escuro ===================== */
function applyTheme(choice) {
  if (choice === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  $$(".theme-switch button").forEach(button => {
    button.setAttribute("aria-pressed", button.dataset.themeChoice === choice ? "true" : "false");
  });
}

function initTheme() {
  let saved = "auto";
  try { saved = localStorage.getItem(THEME_STORAGE_KEY) || "auto"; } catch (_) { /* segue no auto */ }
  applyTheme(saved);
  $$(".theme-switch button").forEach(button => {
    button.addEventListener("click", () => {
      const choice = button.dataset.themeChoice;
      applyTheme(choice);
      try {
        if (choice === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
        else localStorage.setItem(THEME_STORAGE_KEY, choice);
      } catch (_) { /* armazenamento indisponível */ }
    });
  });
}

/* =====================================================================
   COMPONENTES DE INTERFACE PERSONALIZADOS
   Máscara de moeda, select, stepper e animação — todos progressivos:
   os elementos nativos continuam sendo a fonte de estado (readForm intacto).
   ===================================================================== */

const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- máscara monetária (centavos, da direita para a esquerda) ---------- */
/* "3" -> "0,03"; "350" -> "3,50"; "350000" -> "3.500,00" */
function digitsToBRL(digits) {
  digits = String(digits).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  const cents = digits.padStart(3, "0");
  const intPart = cents.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${intPart},${cents.slice(-2)}`;
}

/* Campos de modo percentual: dígitos e uma vírgula, sem máscara de centavos. */
function sanitizePercent(raw) {
  let text = String(raw).replace(/[^\d,]/g, "");
  const parts = text.split(",");
  if (parts.length > 2) text = parts[0] + "," + parts.slice(1).join("");
  return text;
}

/* Ativa a máscara num input .money-input dentro de um .money-field.
   Campos de modo duplo (data-mode-select) alternam entre R$ e %. */
function enhanceMoneyField(input) {
  const field = input && input.closest(".money-field");
  if (!field || input._moneyEnhanced) return;
  input._moneyEnhanced = true;

  const affix = field.querySelector(".money-affix");
  const modeSelectId = field.dataset.modeSelect;
  const isPercent = () => {
    if (!modeSelectId) return false;
    const select = document.getElementById(modeSelectId);
    return !!select && select.value === "percent";
  };

  const applyFormat = () => {
    if (isPercent()) {
      field.classList.add("is-percent");
      if (affix) affix.textContent = "%";
      input.value = sanitizePercent(input.value);
      input.placeholder = "0";
    } else {
      field.classList.remove("is-percent");
      if (affix) affix.textContent = "R$";
      input.value = digitsToBRL(input.value.replace(/\D/g, ""));
      input.placeholder = "0,00";
    }
  };

  input.addEventListener("input", applyFormat);
  applyFormat();

  if (modeSelectId) {
    const select = document.getElementById(modeSelectId);
    if (select) {
      select.addEventListener("change", () => {
        input.value = "";        // evita converter R$ em % (e vice-versa)
        applyFormat();
      });
    }
  }
}

/* ---------- select personalizado (listbox acessível) ---------- */
const CHECK_SVG = "<svg viewBox='0 0 16 16' width='15' height='15' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M13 4.5 6.5 11 3.4 7.9'/></svg>";
const CHEVRON_SVG = "<svg viewBox='0 0 16 16' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><path d='M4 6l4 4 4-4'/></svg>";
const CALENDAR_SVG = "<svg viewBox='0 0 24 24' width='17' height='17' fill='none' stroke='currentColor' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'><rect x='3' y='4.5' width='18' height='16' rx='3'/><path d='M3 9.5h18M8 3v3M16 3v3'/></svg>";
const CHEVRON_LEFT_SVG = "<svg viewBox='0 0 16 16' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M10 4l-4 4 4 4'/></svg>";
const CHEVRON_RIGHT_SVG = "<svg viewBox='0 0 16 16' width='16' height='16' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M6 4l4 4-4 4'/></svg>";

function enhanceSelect(native) {
  if (native._selectEnhanced) return;
  native._selectEnhanced = true;

  const wrap = document.createElement("div");
  wrap.className = "select";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const labelEl = native.id ? document.querySelector(`label[for="${native.id}"]`) : null;
  if (labelEl) {
    if (!labelEl.id) labelEl.id = native.id + "-label";
    trigger.setAttribute("aria-labelledby", labelEl.id);
  }

  const valueSpan = document.createElement("span");
  valueSpan.className = "select-value";
  const chevron = document.createElement("span");
  chevron.className = "select-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = CHEVRON_SVG;
  trigger.append(valueSpan, chevron);

  const menu = document.createElement("ul");
  menu.className = "select-menu";
  menu.setAttribute("role", "listbox");
  if (labelEl && labelEl.id) menu.setAttribute("aria-labelledby", labelEl.id);

  const optionEls = Array.from(native.options).map((option) => {
    const li = document.createElement("li");
    li.className = "select-option";
    li.setAttribute("role", "option");
    li.dataset.value = option.value;
    li.innerHTML = `<span class="opt-check" aria-hidden="true">${CHECK_SVG}</span><span class="opt-label"></span>`;
    li.querySelector(".opt-label").textContent = option.textContent;
    menu.appendChild(li);
    return li;
  });

  native.parentNode.insertBefore(wrap, native);
  native.classList.add("select-native-hidden");
  native.setAttribute("tabindex", "-1");
  native.setAttribute("aria-hidden", "true");
  wrap.append(native, trigger, menu);

  let activeIndex = Math.max(0, native.selectedIndex);

  const syncFromNative = () => {
    const selected = native.options[native.selectedIndex];
    valueSpan.textContent = selected ? selected.textContent : "";
    optionEls.forEach((li, i) =>
      li.setAttribute("aria-selected", i === native.selectedIndex ? "true" : "false"));
  };

  const setActive = (i) => {
    activeIndex = (i + optionEls.length) % optionEls.length;
    optionEls.forEach((li, idx) => li.classList.toggle("active", idx === activeIndex));
    optionEls[activeIndex].scrollIntoView({ block: "nearest" });
  };

  const onDocPointer = (event) => { if (!wrap.contains(event.target)) close(); };

  function open() {
    if (wrap.classList.contains("open")) return;
    wrap.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    setActive(native.selectedIndex < 0 ? 0 : native.selectedIndex);
    document.addEventListener("click", onDocPointer, true);
  }
  function close() {
    if (!wrap.classList.contains("open")) return;
    wrap.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDocPointer, true);
  }
  function choose(i) {
    if (native.selectedIndex !== i) {
      native.selectedIndex = i;
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
    close();
    trigger.focus();
  }

  trigger.addEventListener("click", () => (wrap.classList.contains("open") ? close() : open()));
  trigger.addEventListener("keydown", (event) => {
    const isOpen = wrap.classList.contains("open");
    switch (event.key) {
      case "ArrowDown": event.preventDefault(); isOpen ? setActive(activeIndex + 1) : open(); break;
      case "ArrowUp": event.preventDefault(); isOpen ? setActive(activeIndex - 1) : open(); break;
      case "Enter": case " ": event.preventDefault(); isOpen ? choose(activeIndex) : open(); break;
      case "Home": if (isOpen) { event.preventDefault(); setActive(0); } break;
      case "End": if (isOpen) { event.preventDefault(); setActive(optionEls.length - 1); } break;
      case "Escape": if (isOpen) { event.preventDefault(); close(); } break;
      case "Tab": close(); break;
    }
  });
  optionEls.forEach((li, i) => {
    li.addEventListener("click", () => choose(i));
    li.addEventListener("mousemove", () => setActive(i));
  });

  native.addEventListener("change", syncFromNative); // reflete mudanças programáticas
  syncFromNative();
}

/* ---------- seletor de mês personalizado (substitui input[type=month]) ---------- */
const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function enhanceMonthPicker(native) {
  if (native._monthEnhanced) return;
  native._monthEnhanced = true;

  const wrap = document.createElement("div");
  wrap.className = "month-picker";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "month-trigger";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  const labelEl = native.id ? document.querySelector(`label[for="${native.id}"]`) : null;
  if (labelEl) {
    if (!labelEl.id) labelEl.id = native.id + "-label";
    trigger.setAttribute("aria-labelledby", labelEl.id);
  }
  const icon = document.createElement("span");
  icon.className = "month-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = CALENDAR_SVG;
  const valueSpan = document.createElement("span");
  valueSpan.className = "month-value";
  trigger.append(icon, valueSpan);

  const panel = document.createElement("div");
  panel.className = "month-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Selecionar mês e ano");
  const head = document.createElement("div");
  head.className = "month-head";
  const prevBtn = document.createElement("button");
  prevBtn.type = "button"; prevBtn.className = "month-nav";
  prevBtn.setAttribute("aria-label", "Ano anterior"); prevBtn.innerHTML = CHEVRON_LEFT_SVG;
  const yearLabel = document.createElement("span");
  yearLabel.className = "month-year"; yearLabel.setAttribute("aria-live", "polite");
  const nextBtn = document.createElement("button");
  nextBtn.type = "button"; nextBtn.className = "month-nav";
  nextBtn.setAttribute("aria-label", "Próximo ano"); nextBtn.innerHTML = CHEVRON_RIGHT_SVG;
  head.append(prevBtn, yearLabel, nextBtn);

  const grid = document.createElement("div");
  grid.className = "month-grid";
  const cells = MONTH_ABBR.map((abbr, i) => {
    const cell = document.createElement("button");
    cell.type = "button"; cell.className = "month-cell"; cell.textContent = abbr;
    cell.setAttribute("aria-label", MONTH_NAMES[i]);
    grid.appendChild(cell);
    return cell;
  });
  panel.append(head, grid);

  native.parentNode.insertBefore(wrap, native);
  native.classList.add("select-native-hidden");
  native.setAttribute("tabindex", "-1");
  native.setAttribute("aria-hidden", "true");
  wrap.append(native, trigger, panel);

  const now = new Date();
  const todayYear = now.getFullYear(), todayMonth = now.getMonth() + 1;

  const parseValue = () => {
    const match = (native.value || "").match(/^(\d{4})-(\d{2})$/);
    return match
      ? { year: +match[1], month: +match[2] }
      : { year: todayYear, month: todayMonth };
  };
  let state = parseValue();     // mês/ano selecionado
  let viewYear = state.year;    // ano exibido no painel

  const renderLabel = () => {
    valueSpan.textContent = `${MONTH_NAMES[state.month - 1]} de ${state.year}`;
  };
  const renderPanel = () => {
    yearLabel.textContent = String(viewYear);
    cells.forEach((cell, i) => {
      const selected = viewYear === state.year && i + 1 === state.month;
      cell.classList.toggle("selected", selected);
      cell.classList.toggle("today", viewYear === todayYear && i + 1 === todayMonth);
      cell.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  };

  const onDocPointer = (event) => { if (!wrap.contains(event.target)) close(); };
  function open() {
    if (wrap.classList.contains("open")) return;
    state = parseValue();      // re-sincroniza caso o valor tenha mudado por fora
    viewYear = state.year;
    renderPanel();
    wrap.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("click", onDocPointer, true);
  }
  function close() {
    if (!wrap.classList.contains("open")) return;
    wrap.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", onDocPointer, true);
  }
  const pick = (monthIndex) => {
    state = { year: viewYear, month: monthIndex + 1 };
    native.value = `${state.year}-${String(state.month).padStart(2, "0")}`;
    native.dispatchEvent(new Event("change", { bubbles: true }));
    renderLabel();
    close();
    trigger.focus();
  };

  trigger.addEventListener("click", () => (wrap.classList.contains("open") ? close() : open()));
  trigger.addEventListener("keydown", (event) => {
    if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); open(); }
    else if (event.key === "Escape") close();
  });
  prevBtn.addEventListener("click", () => { viewYear--; renderPanel(); });
  nextBtn.addEventListener("click", () => { viewYear++; renderPanel(); });
  cells.forEach((cell, i) => cell.addEventListener("click", () => pick(i)));
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); trigger.focus(); }
  });
  // reflete mudanças programáticas do valor (init/restauração)
  native.addEventListener("change", () => { state = parseValue(); renderLabel(); });

  renderLabel();
}

/* ---------- stepper numérico (− valor +) ---------- */
function enhanceStepper(input) {
  if (input._stepperEnhanced) return;
  input._stepperEnhanced = true;

  const wrap = document.createElement("div");
  wrap.className = "stepper";
  const makeBtn = (sign, label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stepper-btn";
    button.tabIndex = -1;
    button.textContent = sign;
    button.setAttribute("aria-label", label);
    return button;
  };
  const decrement = makeBtn("−", "Diminuir");
  const increment = makeBtn("+", "Aumentar");

  input.parentNode.insertBefore(wrap, input);
  wrap.append(decrement, input, increment);

  const step = parseFloat(input.step) || 1;
  const min = input.min !== "" ? parseFloat(input.min) : -Infinity;
  const max = input.max !== "" ? parseFloat(input.max) : Infinity;

  const refresh = () => {
    const current = parseFloat(input.value);
    decrement.disabled = !isNaN(current) && current <= min;
    increment.disabled = !isNaN(current) && current >= max;
  };
  const nudge = (direction) => {
    const current = parseFloat(input.value);
    const base = isNaN(current) ? (min > -Infinity ? min : 0) : current;
    let next = base + direction * step;
    next = Math.min(max, Math.max(min, Math.round(next / step) * step));
    input.value = String(parseFloat(next.toFixed(6)));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    refresh();
  };

  decrement.addEventListener("click", () => nudge(-1));
  increment.addEventListener("click", () => nudge(1));
  input.addEventListener("input", refresh);
  refresh();
}

/* ---------- animação de contagem no salário líquido ---------- */
function setNetSalary(element, value) {
  const previous = element._netValue != null ? element._netValue : 0;
  if (prefersReducedMotion() || Math.abs(value - previous) < 0.005) {
    if (element._raf) cancelAnimationFrame(element._raf);
    element._netValue = value;
    element.textContent = formatCurrency(value);
    return;
  }
  if (element._raf) cancelAnimationFrame(element._raf);
  const from = previous, to = value, start = performance.now(), duration = 340;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const current = from + (to - from) * eased;
    element._netValue = current;
    element.textContent = formatCurrency(current);
    if (t < 1) element._raf = requestAnimationFrame(tick);
    else { element._netValue = to; element.textContent = formatCurrency(to); element._raf = null; }
  };
  element._raf = requestAnimationFrame(tick);
}

/* Aplica todos os componentes personalizados ao formulário. */
function enhanceControls() {
  $$("#payroll-form select").forEach(enhanceSelect);
  $$("#payroll-form input[type='month']").forEach(enhanceMonthPicker);
  $$("#payroll-form .money-input").forEach(enhanceMoneyField);
  $$("#payroll-form input[type='number']").forEach(enhanceStepper);
}

/* ===================== eventos e inicialização ===================== */
function handleChange() {
  saveFormState();
  renderResult();
}

function updateHoursEcho(element) {
  const echo = document.querySelector(`[data-echo-for="${element.id}"]`);
  if (!echo) return;
  const value = parseHours(element.value);
  echo.textContent = element.value.trim()
    ? `= ${formatHoursLabel(value)} (${value.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} h)`
    : "";
}

function initEvents() {
  $("#payroll-form").addEventListener("input", (event) => {
    const element = event.target;
    if (element.id === "business-days" || element.id === "rest-days") dsrManuallyEdited = true;
    if (element.classList.contains("hours-input")) updateHoursEcho(element);
    handleChange();
  });
  $("#payroll-form").addEventListener("change", handleChange);

  $("#work-schedule").addEventListener("change", () => {
    $("#custom-schedule-field").classList.toggle("hidden", $("#work-schedule").value !== "custom");
  });

  $("#reference-month").addEventListener("change", () => {
    dsrManuallyEdited = false;
    autofillDsr();
    handleChange();
  });

  $("#add-earning").addEventListener("click", () => addDynamicItem("#earnings-list", true));
  $("#add-deduction").addEventListener("click", () => addDynamicItem("#deductions-list", false));

  $("#clear-form").addEventListener("click", () => {
    if (!confirm("Limpar todos os campos preenchidos?")) return;
    try { localStorage.removeItem(FORM_STORAGE_KEY); } catch (_) { /* segue */ }
    // Limpa todos os inputs de texto/número, inclusive os sem type explícito
    // (moeda e horas): a checagem por .type resolve o default "text".
    $$("#payroll-form input").forEach(element => {
      if (element.type === "checkbox" || element.type === "month") return;
      element.value = element.id === "night-rate" ? "20" : "";
    });
    ["ir-dependents", "family-children", "absence-days", "lost-rest-days"].forEach(id => { $("#" + id).value = "0"; });
    $$("#payroll-form input[type='checkbox']").forEach(element => { element.checked = element.id === "dsr-enabled"; });
    $("#work-schedule").value = "220";
    $("#custom-schedule-field").classList.add("hidden");
    $("#alimony-mode").value = "fixed";
    $("#advance-mode").value = "fixed";
    $("#unhealthy-level").value = "0";
    $("#unhealthy-base").value = "minimum-wage";
    // Ressincroniza os selects personalizados e reformata os campos de modo duplo.
    ["work-schedule", "alimony-mode", "advance-mode", "unhealthy-level", "unhealthy-base"]
      .forEach(id => $("#" + id).dispatchEvent(new Event("change", { bubbles: true })));
    $$("#earnings-list .dynamic-item, #deductions-list .dynamic-item").forEach(element => element.remove());
    $$(".hours-echo").forEach(element => { element.textContent = ""; });
    dsrManuallyEdited = false;
    autofillDsr();
    renderResult();
  });

  // Navegação por abas.
  $$(".tabs button").forEach(button => button.addEventListener("click", () => {
    $$(".tabs button").forEach(other => other.setAttribute("aria-selected", other === button ? "true" : "false"));
    ["calculator-view", "settings-view", "sources-view"].forEach(id => {
      $("#" + id).hidden = id !== button.dataset.view;
    });
  }));

  // Aba de parâmetros.
  $("#add-inss-bracket").addEventListener("click", () => {
    activeParams.inss.brackets.push({ upTo: activeParams.inss.ceiling, rate: 14 });
    renderSettings();
  });
  $("#add-irrf-bracket").addEventListener("click", () => {
    activeParams.irrf.brackets.push({ upTo: null, rate: 27.5, deduction: 0 });
    renderSettings();
  });

  $("#settings-view").addEventListener("click", (event) => {
    const removeInss = event.target.getAttribute && event.target.getAttribute("data-remove-inss");
    const removeIrrf = event.target.getAttribute && event.target.getAttribute("data-remove-irrf");
    if (removeInss != null) { activeParams.inss.brackets.splice(Number(removeInss), 1); renderSettings(); }
    if (removeIrrf != null) { activeParams.irrf.brackets.splice(Number(removeIrrf), 1); renderSettings(); }
  });

  $("#save-settings").addEventListener("click", () => {
    if (!readSettings()) return;
    try { localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(activeParams)); } catch (_) { /* segue */ }
    renderSettings();
    updateBadges();
    renderResult();
    const note = $("#settings-saved-note");
    note.classList.remove("hidden");
    setTimeout(() => note.classList.add("hidden"), 2500);
  });

  $("#reset-settings").addEventListener("click", () => {
    if (!confirm("Restaurar todos os parâmetros para os padrões de 2026?")) return;
    try { localStorage.removeItem(PARAMS_STORAGE_KEY); } catch (_) { /* segue */ }
    activeParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
    renderSettings();
    updateBadges();
    renderResult();
  });

  $("#export-settings").addEventListener("click", () => {
    readSettings();
    $("#settings-json").value = JSON.stringify(activeParams, null, 2);
  });

  $("#import-settings").addEventListener("click", () => {
    try {
      const imported = JSON.parse($("#settings-json").value);
      if (!imported.inss || !imported.irrf) throw new Error("estrutura inválida");
      activeParams = imported;
      try { localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(activeParams)); } catch (_) { /* segue */ }
      renderSettings();
      updateBadges();
      renderResult();
    } catch (error) {
      showSettingsError("JSON inválido: " + error.message);
    }
  });
}

let activeParams;

function init() {
  activeParams = loadParams();
  const today = new Date();
  $("#reference-month").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  initTheme();
  initEvents();
  const restored = restoreFormState();
  if (restored) {
    dsrManuallyEdited = !!($("#business-days").value || $("#rest-days").value);
    $("#custom-schedule-field").classList.toggle("hidden", $("#work-schedule").value !== "custom");
    $$("#payroll-form .hours-input").forEach(updateHoursEcho);
  }
  autofillDsr();
  enhanceControls();   // selects, máscara de moeda e steppers personalizados
  renderSettings();
  updateBadges();
  renderResult();
}

if (typeof document !== "undefined" && document.getElementById("payroll-form")) init();

/* Exporta o motor puro para testes em Node (não afeta o navegador). */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    computePayroll, computeInss, computeIrrf, taxFromTable,
    parseCurrency, parseHours, monthCalendar, DEFAULT_PARAMS
  };
}
