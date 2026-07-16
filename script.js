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
            {upTo: 1621.00, rate: 7.5},
            {upTo: 2902.84, rate: 9.0},
            {upTo: 4354.27, rate: 12.0},
            {upTo: 8475.55, rate: 14.0}
        ]
    },
    irrf: {                          // Receita Federal, tabela mensal 2026
        brackets: [
            {upTo: 2428.80, rate: 0, deduction: 0},
            {upTo: 2826.65, rate: 7.5, deduction: 182.16},
            {upTo: 3751.05, rate: 15.0, deduction: 394.16},
            {upTo: 4664.68, rate: 22.5, deduction: 675.49},
            {upTo: null, rate: 27.5, deduction: 908.73}
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
    familyAllowance: {quota: 67.54, incomeLimit: 1980.38}, // Portaria MPS/MF nº 13/2026
    fgtsRate: 8,                                             // Lei nº 8.036/1990
    severance: {                     // Lei nº 12.506/2011 (aviso prévio) e Lei nº 8.036/1990, art. 18 (multas)
        noticeBaseDays: 30,
        noticePerYearDays: 3,
        noticeMaxDays: 90,
        finePercent: 40,               // dispensa sem justa causa (art. 18, § 1º)
        agreementFinePercent: 20       // acordo (CLT, art. 484-A) e culpa recíproca (art. 18, § 2º)
    },
    unemployment: {                  // Seguro-desemprego: tabela do MTE vigente desde 11/01/2026 (Lei nº 7.998/1990)
        firstLimit: 2222.17,           // até aqui: salário médio × 0,8
        firstFactor: 0.8,
        secondLimit: 3703.99,          // até aqui: 1.777,74 + 50% do que exceder a faixa 1
        secondBase: 1777.74,
        secondFactor: 0.5,
        ceiling: 2518.65               // acima: parcela fixa no teto (piso do benefício = salário mínimo)
    },
    pj: {                            // Simulação PJ × CLT
        proLaboreInssRate: 11,         // contribuinte individual (Lei nº 8.212/1991, art. 21)
        factorRThreshold: 28,          // Fator R (LC nº 123/2006, art. 18, §§ 5º-J e 5º-M)
        dividends: {                   // IRRF sobre lucros (Lei nº 15.270/2025, art. 6º-A da Lei nº 9.250/1995)
            rate: 10,
            monthlyExemption: 50000.00   // por fonte pagadora (CNPJ) e por beneficiário (CPF), apurado no mês
        },
        simples: {                     // Simples Nacional, tabelas anuais por RBT12 (LC nº 123/2006)
            annexIII: [                  // serviços em geral; exige Fator R ≥ 28%
                {upTo: 180000.00, rate: 6.0, deduction: 0},
                {upTo: 360000.00, rate: 11.2, deduction: 9360.00},
                {upTo: 720000.00, rate: 13.5, deduction: 17640.00},
                {upTo: 1800000.00, rate: 16.0, deduction: 35640.00},
                {upTo: 3600000.00, rate: 21.0, deduction: 125640.00},
                {upTo: 4800000.00, rate: 33.0, deduction: 648000.00}
            ],
            annexV: [                    // serviços de maior valor agregado; Fator R < 28%
                {upTo: 180000.00, rate: 15.5, deduction: 0},
                {upTo: 360000.00, rate: 18.0, deduction: 4500.00},
                {upTo: 720000.00, rate: 19.5, deduction: 9900.00},
                {upTo: 1800000.00, rate: 20.5, deduction: 17100.00},
                {upTo: 3600000.00, rate: 23.0, deduction: 62100.00},
                {upTo: 4800000.00, rate: 30.5, deduction: 540000.00}
            ]
        }
    }
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
        .toLocaleString("pt-BR", {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function formatCurrency(value) {
    return "R$ " + formatNumber(value);
}

function formatPercent(value) {
    return (isFinite(value) ? value : 0)
        .toLocaleString("pt-BR", {minimumFractionDigits: 1, maximumFractionDigits: 1}) + "%";
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

/* Escapa conteúdo dinâmico inserido via innerHTML. */
function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;");
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

/* ===================== datas do contrato (rescisão) ===================== */
const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDate(text) {
    const match = String(text || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const date = new Date(+match[1], +match[2] - 1, +match[3]);
    return isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
}

/* Soma meses sem "estourar" o mês (31/01 + 1 mês = 28/02, não 03/03). */
function addMonthsClamped(date, months) {
    const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(date.getDate(), lastDay));
    return target;
}

/* Dias corridos entre duas datas, contando as duas pontas. */
function diffDays(from, to) {
    return Math.round((to - from) / DAY_MS) + 1;
}

function fullYearsBetween(from, to) {
    let years = to.getFullYear() - from.getFullYear();
    if (addMonthsClamped(from, years * 12) > to) years--;
    return Math.max(0, years);
}

/* Avos de 1/12 por mês civil: fração ≥ 15 dias conta como mês integral
   (Lei nº 4.090/1962, art. 1º, § 2º — 13º; Lei nº 7.998/1990, art. 4º, § 3º). */
function calendarTwelfths(from, to, cap) {
    if (!from || !to || to < from) return 0;
    const limit = cap == null ? 12 : cap;
    let count = 0;
    let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
    while (cursor <= to && count < limit) {
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const start = from > cursor ? from : cursor;
        const end = to < monthEnd ? to : monthEnd;
        if (diffDays(start, end) >= 15) count++;
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return count;
}

/* Avos do período aquisitivo de férias: janelas mensais ancoradas no início do
   período; fração superior a 14 dias conta (CLT, art. 146, parágrafo único). */
function anniversaryTwelfths(from, to) {
    if (!from || !to || to < from) return 0;
    let count = 0;
    for (let n = 0; n < 12; n++) {
        const start = addMonthsClamped(from, n);
        if (start > to) break;
        const windowEnd = addDays(addMonthsClamped(from, n + 1), -1);
        const end = to < windowEnd ? to : windowEnd;
        if (diffDays(start, end) >= 15) count++;
    }
    return count;
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
            steps.push({from: previousLimit, to: limit, rate: bracket.rate, amount});
        }
        if (bracket.upTo != null) {
            previousLimit = bracket.upTo;
            if (cappedBase <= bracket.upTo) break;
        }
    }
    return {total: round2(total), steps, capped: base > ceiling, ceiling};
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
        if (amount > 0.004) earnings.push({label, ref, amount: round2(amount), ...bases});
    };
    const addDeduction = (label, ref, amount) => {
        if (amount > 0.004) deductions.push({label, ref, amount: round2(amount)});
    };
    const ALL_BASES = {inss: true, irrf: true, fgts: true};

    addEarning("Salário base", formatHoursLabel(schedule), input.baseSalary, ALL_BASES);
    addEarning("Adicional de periculosidade", "30%", hazardAmount, ALL_BASES);
    addEarning(`Adicional de insalubridade (${input.unhealthy.level}%)`,
        input.unhealthy.base === "base-salary" ? "sal. base" : "sal. mín.", unhealthyAmount, ALL_BASES);

    let variablePayTotal = 0;
    const overtimeRows = [
        {label: "Horas extras 50%", hours: input.overtime50, factor: 1.5},
        {label: "Horas extras 100%", hours: input.overtime100, factor: 2.0},
        {
            label: `Horas extras ${input.extraRate}%`,
            hours: input.extraRate > 0 ? input.extraHours : 0,
            factor: 1 + input.extraRate / 100
        }
    ];
    for (const row of overtimeRows) {
        if (row.hours > 0) {
            const amount = hourlyRate * row.factor * row.hours;
            variablePayTotal += amount;
            addEarning(row.label, formatHoursLabel(row.hours), amount, ALL_BASES);
        }
    }

    if (input.night.hours > 0 && input.night.rate > 0) {
        // Hora noturna reduzida: 52min30s contam como 1h (fator 60/52,5).
        const effectiveHours = input.night.hours * (input.night.reduced ? 60 / 52.5 : 1);
        const nightAmount = hourlyRate * (input.night.rate / 100) * effectiveHours;
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
                {inss: item.inss, irrf: item.irrf, fgts: item.fgts});
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
            {inss: false, irrf: false, fgts: false});
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

/* 13º salário (gratificação natalina): 1/12 da remuneração (salário + médias
   de variáveis) por mês trabalhado no ano; fração ≥ 15 dias conta como mês
   (Lei nº 4.090/1962; Decreto nº 10.854/2021). A 1ª parcela, paga entre 1º/02
   e 30/11, não tem descontos (Lei nº 4.749/1965). O INSS é calculado em
   separado da folha do mês (Lei nº 8.212/1991, art. 28, § 7º) e o IRRF é
   exclusivo na fonte sobre o valor integral, com o redutor da Lei nº
   15.270/2025 (IN RFB nº 1.500/2014, arts. 13 e 65-A, § 3º). */
function computeThirteenth(input, params) {
    const months = Math.min(12, Math.max(1, Math.round(input.months || 12)));
    const base = round2(input.baseSalary + (input.averages || 0));
    const gross = round2(base * months / 12);
    const firstInstallment = round2(gross / 2);
    const inss = computeInss(gross, params);
    const alimonyAmount = round2(input.alimony.mode === "percent"
        ? gross * input.alimony.value / 100
        : input.alimony.value);
    const legalDeductions = inss.total + input.irDependents * params.irrf.dependentDeduction + alimonyAmount;
    const irrf = computeIrrf(gross, legalDeductions, params);
    const totalDeductions = round2(inss.total + irrf.total + alimonyAmount);
    const net = round2(gross - totalDeductions);
    return {
        months, base, gross, firstInstallment,
        secondInstallment: round2(net - firstInstallment),
        inss, irrf, alimonyAmount, totalDeductions, net,
        fgtsAmount: round2(gross * params.fgtsRate / 100)
    };
}

/* Férias: remuneração dos dias gozados + terço constitucional (CF, art. 7º,
   XVII), ambos tributáveis; INSS e IRRF calculados em separado dos demais
   rendimentos do mês (RIR/2018, art. 682), com o redutor da Lei nº 15.270/2025.
   O abono pecuniário — venda de até 1/3 dos dias (CLT, art. 143) — e o terço
   sobre ele são isentos de IRRF (IN RFB nº 1.500/2014, art. 62) e não integram
   o salário de contribuição nem a base do FGTS (Lei nº 8.212/1991, art. 28,
   § 9º). O adiantamento da 1ª parcela do 13º nas férias (Lei nº 4.749/1965,
   art. 2º, § 2º) é pago sem descontos, mas recebe depósito de FGTS. */
function computeVacation(input, params) {
    const days = Math.min(30, Math.max(1, Math.round(input.days || 30)));
    const soldDays = Math.min(Math.floor(days / 3), Math.max(0, Math.round(input.soldDays || 0)));
    const restDays = days - soldDays;
    const base = round2(input.baseSalary + (input.averages || 0));
    const dayValue = base / 30;
    const vacationPay = round2(dayValue * restDays);
    const vacationThird = round2(vacationPay / 3);
    const taxableGross = round2(vacationPay + vacationThird);
    const abonoPay = round2(dayValue * soldDays);
    const abonoThird = round2(abonoPay / 3);
    const thirteenthAdvance = input.advanceThirteenth ? round2(base / 2) : 0;
    const inss = computeInss(taxableGross, params);
    const alimonyAmount = round2(input.alimony.mode === "percent"
        ? taxableGross * input.alimony.value / 100
        : input.alimony.value);
    const legalDeductions = inss.total + input.irDependents * params.irrf.dependentDeduction + alimonyAmount;
    const irrf = computeIrrf(taxableGross, legalDeductions, params);
    const totalEarnings = round2(taxableGross + abonoPay + abonoThird + thirteenthAdvance);
    const totalDeductions = round2(inss.total + irrf.total + alimonyAmount);
    const fgtsVacation = round2(taxableGross * params.fgtsRate / 100);
    const fgtsAdvance = round2(thirteenthAdvance * params.fgtsRate / 100);
    return {
        days, soldDays, restDays, base,
        vacationPay, vacationThird, taxableGross, abonoPay, abonoThird,
        thirteenthAdvance, inss, irrf, alimonyAmount,
        totalEarnings, totalDeductions, net: round2(totalEarnings - totalDeductions),
        fgtsVacation, fgtsAdvance, fgtsAmount: round2(fgtsVacation + fgtsAdvance)
    };
}

/* Regras por modalidade de rescisão (CLT, arts. 477 a 486 e 484-A; Lei nº
   8.036/1990, arts. 18 e 20; Súmulas 14, 171 e 261 do TST):
   - notice: quem deve o aviso ("employer", "employee", "half" na culpa
     recíproca — sempre metade indenizada — ou "none");
   - noticeFactor: fração do aviso indenizado paga (0,5 = metade no acordo);
   - thirteenth/vacation: fração dos avos devida (0 = perde na justa causa;
     0,5 = metade na culpa recíproca);
   - fineKey: chave do percentual da multa do FGTS em params.severance;
   - withdraw: "full" saca saldo + multa, "partial" até 80% (art. 484-A,
     § 1º), "none" mantém o saldo na conta vinculada;
   - unemployment: dispensa involuntária que habilita o seguro-desemprego. */
const SEVERANCE_RULES = {
    "no-cause": {
        notice: "employer",
        noticeFactor: 1,
        thirteenth: 1,
        vacation: 1,
        fineKey: "finePercent",
        withdraw: "full",
        unemployment: true
    },
    "agreement": {
        notice: "employer",
        noticeFactor: 0.5,
        thirteenth: 1,
        vacation: 1,
        fineKey: "agreementFinePercent",
        withdraw: "partial",
        unemployment: false
    },
    "resignation": {
        notice: "employee",
        noticeFactor: 0,
        thirteenth: 1,
        vacation: 1,
        fineKey: null,
        withdraw: "none",
        unemployment: false
    },
    "with-cause": {
        notice: "none",
        noticeFactor: 0,
        thirteenth: 0,
        vacation: 0,
        fineKey: null,
        withdraw: "none",
        unemployment: false
    },
    "indirect": {
        notice: "employer",
        noticeFactor: 1,
        thirteenth: 1,
        vacation: 1,
        fineKey: "finePercent",
        withdraw: "full",
        unemployment: true
    },
    "mutual-fault": {
        notice: "half",
        noticeFactor: 0.5,
        thirteenth: 0.5,
        vacation: 0.5,
        fineKey: "agreementFinePercent",
        withdraw: "full",
        unemployment: false
    },
    "term-end": {
        notice: "none",
        noticeFactor: 0,
        thirteenth: 1,
        vacation: 1,
        fineKey: null,
        withdraw: "full",
        unemployment: false
    },
    "term-early-employer": {
        notice: "none",
        noticeFactor: 0,
        thirteenth: 1,
        vacation: 1,
        fineKey: "finePercent",
        withdraw: "full",
        unemployment: true,
        indemnity479: true
    },
    "term-early-employee": {
        notice: "none",
        noticeFactor: 0,
        thirteenth: 1,
        vacation: 1,
        fineKey: null,
        withdraw: "none",
        unemployment: false,
        indemnity480: true
    },
    "death": {
        notice: "none",
        noticeFactor: 0,
        thirteenth: 1,
        vacation: 1,
        fineKey: null,
        withdraw: "full",
        unemployment: false
    }
};

/* Aviso prévio proporcional: 30 dias + 3 por ano completo de serviço, até 90
   (Lei nº 12.506/2011; Nota Técnica MTE nº 184/2012). */
function computeNoticeDays(serviceYears, params) {
    const rule = params.severance;
    return Math.min(rule.noticeMaxDays, rule.noticeBaseDays + rule.noticePerYearDays * Math.max(0, serviceYears));
}

/* Seguro-desemprego (estimativa): carência e nº de parcelas da Lei nº
   7.998/1990, arts. 3º e 4º (redação da Lei nº 13.134/2015), usando o tempo do
   próprio vínculo como meses trabalhados nos últimos 36; valor da parcela pelas
   faixas do MTE sobre a média salarial, entre o salário mínimo e o teto, com
   arredondamento para o inteiro imediatamente superior (art. 4º, § 4º). */
function computeUnemployment(input, params) {
    const table = params.unemployment;
    const request = Math.max(1, Math.min(3, Math.round(input.requestNumber || 1)));
    const months = Math.min(36, input.monthsWorked);
    const minimumMonths = request === 1 ? 12 : request === 2 ? 9 : 6;
    const meetsMinimum = months >= minimumMonths;
    let installments = 0;
    if (input.eligible && meetsMinimum) {
        installments = months >= 24 ? 5 : months >= 12 ? 4 : 3;
    }
    const average = input.averageSalary;
    let value;
    if (average <= table.firstLimit) value = average * table.firstFactor;
    else if (average <= table.secondLimit) value = table.secondBase + (average - table.firstLimit) * table.secondFactor;
    else value = table.ceiling;
    value = Math.ceil(Math.min(table.ceiling, Math.max(params.minimumWage, value)));
    const installmentValue = installments > 0 ? value : 0;
    return {
        eligible: !!input.eligible, request, monthsCounted: months, minimumMonths, meetsMinimum,
        installments, installmentValue, total: round2(installments * installmentValue)
    };
}

/* Rescisão do contrato: saldo de salário, aviso prévio, 13º e férias com a
   projeção do aviso indenizado (CLT, art. 487, § 1º; OJ 82 da SDI-1 do TST),
   indenizações dos contratos a termo (arts. 479/480), FGTS com multa e saque
   e estimativa do seguro-desemprego. Tributação: saldo e 13º pagam INSS e
   IRRF (13º em separado, exclusivo na fonte); aviso indenizado (STJ, Tema
   478; IN RFB nº 2.110/2022, art. 34; Lei nº 7.713/1988, art. 6º, V), férias
   indenizadas + 1/3 (Lei nº 8.212/1991, art. 28, § 9º, "d"; Súmulas 125 e
   386 do STJ) e multa do FGTS são isentos. */
function computeSeverance(input, params) {
    const rules = SEVERANCE_RULES[input.type] || SEVERANCE_RULES["no-cause"];
    const admission = parseIsoDate(input.admissionDate);
    const termination = parseIsoDate(input.terminationDate);
    if (input.baseSalary <= 0 || !admission || !termination || termination < admission) return null;

    const base = round2(input.baseSalary + (input.averages || 0));
    const dayValue = base / 30;

    // Saldo de salário: dias corridos no mês do desligamento (mês comercial de 30;
    // desligamento no último dia do mês paga o mês cheio).
    const monthLastDay = new Date(termination.getFullYear(), termination.getMonth() + 1, 0).getDate();
    const balanceDays = termination.getDate() === monthLastDay ? 30 : Math.min(30, termination.getDate());
    const salaryBalance = round2(input.baseSalary / 30 * balanceDays);

    // Aviso prévio proporcional; indenizado projeta o fim do contrato.
    const serviceYears = fullYearsBetween(admission, termination);
    const noticeDays = computeNoticeDays(serviceYears, params);
    let noticeStatus = "none", noticePaidDays = 0, noticeAmount = 0, noticeDeduction = 0;
    if (rules.notice === "employer") {
        noticeStatus = input.employerNotice === "worked" ? "worked" : "indemnified";
    } else if (rules.notice === "half") {
        noticeStatus = "indemnified"; // culpa recíproca: metade sempre indenizada (Súmula 14 do TST)
    } else if (rules.notice === "employee") {
        noticeStatus = ["worked", "waived", "deducted"].includes(input.employeeNotice) ? input.employeeNotice : "worked";
        if (noticeStatus === "deducted") noticeDeduction = round2(input.baseSalary); // CLT, art. 487, § 2º
    }
    if (noticeStatus === "indemnified") {
        noticePaidDays = noticeDays * rules.noticeFactor;
        noticeAmount = round2(dayValue * noticePaidDays);
    }
    const projectedEnd = addDays(termination, Math.round(noticePaidDays));

    // 13º proporcional: avos por mês civil; a projeção pode cruzar o ano.
    const yearStart = new Date(termination.getFullYear(), 0, 1);
    const thirteenthFrom = admission > yearStart ? admission : yearStart;
    let thirteenthTwelfths;
    if (projectedEnd.getFullYear() > termination.getFullYear()) {
        thirteenthTwelfths = calendarTwelfths(thirteenthFrom, new Date(termination.getFullYear(), 11, 31))
            + calendarTwelfths(new Date(projectedEnd.getFullYear(), 0, 1), projectedEnd);
    } else {
        thirteenthTwelfths = calendarTwelfths(thirteenthFrom, projectedEnd);
    }
    const thirteenthGross = round2(base * thirteenthTwelfths / 12 * rules.thirteenth);

    // Férias proporcionais do período aquisitivo corrente, com projeção.
    const accrualYears = fullYearsBetween(admission, projectedEnd);
    const periodStart = addMonthsClamped(admission, accrualYears * 12);
    const vacationTwelfths = rules.vacation > 0 ? anniversaryTwelfths(periodStart, projectedEnd) : 0;
    const proportionalVacation = round2(base * vacationTwelfths / 12 * rules.vacation);
    const proportionalThird = round2(proportionalVacation / 3);

    // Férias vencidas: devidas em qualquer modalidade, inclusive justa causa
    // (CLT, art. 146, caput); em dobro se vencido o período concessivo (art. 137).
    const expiredPeriods = Math.max(0, Math.min(5, Math.round(input.expiredPeriods || 0)));
    const expiredVacation = round2((base + base / 3) * expiredPeriods * (input.expiredDouble ? 2 : 1));

    // Contrato a termo encerrado antes do prazo (CLT, arts. 479 e 480).
    const contractEnd = parseIsoDate(input.contractEndDate);
    let remainingDays = 0, earlyIndemnity = 0;
    if ((rules.indemnity479 || rules.indemnity480) && contractEnd && contractEnd > termination) {
        remainingDays = Math.round((contractEnd - termination) / DAY_MS);
        if (rules.indemnity479) earlyIndemnity = round2(dayValue * remainingDays / 2);
    }

    // Descontos: INSS/IRRF sobre o saldo; 13º em separado (IRRF exclusivo na fonte).
    const dependentsDeduction = (input.irDependents || 0) * params.irrf.dependentDeduction;
    const inssSalary = computeInss(salaryBalance, params);
    const irrfSalary = computeIrrf(salaryBalance, inssSalary.total + dependentsDeduction, params);
    const inssThirteenth = computeInss(thirteenthGross, params);
    const irrfThirteenth = computeIrrf(thirteenthGross, inssThirteenth.total + dependentsDeduction, params);

    const totalEarnings = round2(salaryBalance + noticeAmount + thirteenthGross
        + expiredVacation + proportionalVacation + proportionalThird + earlyIndemnity);
    const totalDeductions = round2(inssSalary.total + irrfSalary.total
        + inssThirteenth.total + irrfThirteenth.total + noticeDeduction);
    const net = round2(totalEarnings - totalDeductions);

    // FGTS: depósitos sobre as verbas remuneratórias da rescisão (saldo, 13º e
    // aviso indenizado — Súmula 305 do TST); a multa incide sobre todos os
    // depósitos do contrato, mesmo os já sacados (Lei nº 8.036/1990, art. 18).
    const fgtsRate = params.fgtsRate / 100;
    const monthsWorked = calendarTwelfths(admission, termination, 1200);
    const estimatedBalance = round2(base * fgtsRate * (monthsWorked + monthsWorked / 12)); // mensalidades + 13º
    const balanceInformed = input.fgtsBalance > 0;
    const fgtsBalance = balanceInformed ? input.fgtsBalance : estimatedBalance;
    const fgtsDeposits = round2((salaryBalance + thirteenthGross + noticeAmount) * fgtsRate);
    const finePercent = rules.fineKey ? params.severance[rules.fineKey] : 0;
    const fineBase = round2(fgtsBalance + (input.fgtsWithdrawn || 0) + fgtsDeposits);
    const fine = round2(fineBase * finePercent / 100);
    const accountTotal = round2(fgtsBalance + fgtsDeposits + fine);
    const available = rules.withdraw === "full" ? accountTotal
        : rules.withdraw === "partial" ? round2(accountTotal * 0.8) : 0; // CLT, art. 484-A, § 1º

    const unemployment = computeUnemployment({
        eligible: rules.unemployment,
        monthsWorked,
        requestNumber: input.unemploymentRequest,
        averageSalary: base
    }, params);

    return {
        type: input.type, base, balanceDays, salaryBalance,
        serviceYears, noticeDays, noticeStatus, noticePaidDays, noticeAmount, noticeDeduction,
        projectedEnd, projectedDays: Math.round(noticePaidDays),
        thirteenthTwelfths, thirteenthGross, thirteenthFactor: rules.thirteenth,
        vacationTwelfths, proportionalVacation, proportionalThird, vacationFactor: rules.vacation,
        expiredPeriods, expiredDouble: !!input.expiredDouble, expiredVacation,
        remainingDays, earlyIndemnity, owesEmployerIndemnity: !!rules.indemnity480 && remainingDays > 0,
        inssSalary, irrfSalary, inssThirteenth, irrfThirteenth,
        totalEarnings, totalDeductions, net,
        fgts: {
            monthsWorked, balance: fgtsBalance, estimated: !balanceInformed,
            withdrawn: input.fgtsWithdrawn || 0, deposits: fgtsDeposits,
            finePercent, fineBase, fine, accountTotal, available, withdraw: rules.withdraw
        },
        unemployment,
        grandTotal: round2(net + available + unemployment.total)
    };
}

/* ===================== PJ × CLT =====================

   Compara a remuneração de um contrato CLT com o que uma PJ prestadora de
   serviços no Simples Nacional precisa faturar para chegar ao mesmo líquido.

   Simples Nacional (LC nº 123/2006, art. 18): a alíquota efetiva sai de
   (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12, onde RBT12 é a
   receita bruta dos 12 meses anteriores. O Fator R — folha de 12 meses
   (pró-labore incluso) ÷ RBT12 — define o anexo: ≥ 28% cai no Anexo III,
   abaixo disso no Anexo V (§§ 5º-J e 5º-M).

   Pró-labore: 11% de INSS como contribuinte individual, base entre o salário
   mínimo e o teto (Lei nº 8.212/1991, art. 21), mais IRRF pela tabela mensal
   (com o redutor da Lei nº 15.270/2025). A CPP patronal de 20% já está dentro
   do DAS nos anexos III e V, então não entra de novo.

   Lucros: desde 1º/01/2026 há IRRF de 10% quando a distribuição da mesma PJ
   para a mesma pessoa física passa de R$ 50.000 no mês — e a alíquota incide
   sobre o total distribuído, não só sobre o excedente (Lei nº 15.270/2025). */

/* Alíquota efetiva do Simples a partir do RBT12: reusa taxFromTable, que já
   implementa "base × alíquota − parcela a deduzir". */
function simplesEffectiveRate(rbt12, brackets) {
    const last = brackets[brackets.length - 1];
    if (rbt12 <= 0) return {rate: brackets[0].rate / 100, bracket: 1, exceedsLimit: false, limit: last.upTo};
    const index = brackets.findIndex(bracket => bracket.upTo == null || rbt12 <= bracket.upTo);
    return {
        rate: taxFromTable(rbt12, brackets) / rbt12,
        bracket: index === -1 ? brackets.length : index + 1,
        exceedsLimit: last.upTo != null && rbt12 > last.upTo,
        limit: last.upTo
    };
}

function proLaboreAmount(input, monthlyInvoice, params) {
    if (input.proLaboreMode === "fixed") return Math.max(0, input.proLaboreValue || 0);
    if (input.proLaboreMode === "percent") return Math.max(0, monthlyInvoice * (input.proLaboreValue || 0) / 100);
    // "factor-r": pró-labore no mínimo necessário para garantir o Anexo III.
    if (input.proLaboreMode === "factor-r") return monthlyInvoice * params.pj.factorRThreshold / 100;
    return params.minimumWage;
}

/* Faturamento PJ -> líquido anual no bolso do sócio (função pura, sem DOM). */
function computePj(input, params) {
    const rules = params.pj;
    const billedMonths = Math.min(12, Math.max(1, Math.round(input.billedMonths || 12)));
    const monthlyInvoice = Math.max(0, input.monthlyInvoice || 0);
    const proLaboreRaw = proLaboreAmount(input, monthlyInvoice, params);
    const proLabore = round2(proLaboreRaw);

    // RBT12 do regime permanente: os meses faturados repetem-se ano a ano.
    const annualInvoiceRaw = monthlyInvoice * billedMonths;
    const annualInvoice = round2(annualInvoiceRaw);
    const annualProLabore = round2(proLabore * 12);
    // O Fator R compara os dois lados sem arredondar: no modo "28% do faturamento" os
    // centavos perdidos no round2 derrubariam o fator para 27,9996% e jogariam a empresa
    // no Anexo V a cada centavo, serrilhando a curva. A folga de 1e-9 absorve o ruído de
    // ponto flutuante do próprio 0,28.
    const factorR = annualInvoiceRaw > 0 ? proLaboreRaw * 12 / annualInvoiceRaw : 0;
    const factorRAnnex = factorR >= rules.factorRThreshold / 100 - 1e-9 ? "III" : "V";
    const annex = input.annex === "auto" ? factorRAnnex : input.annex;
    const brackets = annex === "III" ? rules.simples.annexIII : rules.simples.annexV;
    const simples = simplesEffectiveRate(annualInvoice, brackets);

    const das = round2(monthlyInvoice * simples.rate);
    const annualDas = round2(annualInvoice * simples.rate);

    // INSS do sócio: 11% sobre o pró-labore, piso no mínimo e topo no teto.
    const inssBase = proLabore > 0
        ? Math.min(Math.max(proLabore, params.minimumWage), params.inss.ceiling)
        : 0;
    const inssProLabore = round2(inssBase * rules.proLaboreInssRate / 100);
    const irrf = computeIrrf(proLabore,
        inssProLabore + (input.irDependents || 0) * params.irrf.dependentDeduction, params);

    const expenses = round2(Math.max(0, input.accountingFee || 0) + Math.max(0, input.otherExpenses || 0));
    const annualExpenses = round2(expenses * 12);
    const annualProfit = round2(annualInvoice - annualDas - annualProLabore - annualExpenses);
    const monthlyProfit = round2(annualProfit / 12);

    const taxedDividends = monthlyProfit > rules.dividends.monthlyExemption;
    const dividendTax = taxedDividends ? round2(monthlyProfit * rules.dividends.rate / 100) : 0;
    const annualDividendTax = round2(dividendTax * 12);

    const annualNet = round2(annualProLabore - round2(inssProLabore * 12) - round2(irrf.total * 12)
        + annualProfit - annualDividendTax);

    return {
        billedMonths, monthlyInvoice, annualInvoice,
        proLabore, annualProLabore, factorR, factorRAnnex, annex, simples,
        das, annualDas, inssBase, inssProLabore, irrf,
        expenses, annualExpenses, annualProfit, monthlyProfit,
        taxedDividends, dividendTax, annualDividendTax,
        netProLabore: round2(proLabore - inssProLabore - irrf.total),
        annualNet, monthlyNet: round2(annualNet / 12),
        totalTax: round2(annualDas + inssProLabore * 12 + irrf.total * 12 + annualDividendTax),
        effectiveBurden: annualInvoice > 0
            ? round2((annualInvoice - annualExpenses - annualNet) / annualInvoice * 100) : 0
    };
}

/* Pacote CLT anual: 11 salários + o mês de férias (com 1/3) + 13º, mais FGTS e
   benefícios quando marcados. É o total que a PJ precisa igualar. */
function computeCltPackage(input, params) {
    const salary = Math.max(0, input.salary || 0);
    const irDependents = input.irDependents || 0;
    const noAlimony = {mode: "fixed", value: 0};

    const inss = computeInss(salary, params);
    const irrf = computeIrrf(salary, inss.total + irDependents * params.irrf.dependentDeduction, params);
    const monthlyNet = round2(salary - inss.total - irrf.total);

    const thirteenth = computeThirteenth(
        {baseSalary: salary, averages: 0, months: 12, irDependents, alimony: noAlimony}, params);
    const vacation = computeVacation(
        {baseSalary: salary, averages: 0, days: 30, soldDays: 0, advanceThirteenth: false, irDependents, alimony: noAlimony},
        params);

    const fgtsMonthly = round2(salary * params.fgtsRate / 100);
    const fgtsYear = round2(fgtsMonthly * 12 + thirteenth.fgtsAmount);
    const fgtsFine = input.countFgts && input.countFgtsFine
        ? round2(fgtsYear * params.severance.finePercent / 100) : 0;
    const fgtsTotal = input.countFgts ? round2(fgtsYear + fgtsFine) : 0;
    const benefits = round2(Math.max(0, input.benefits || 0) * 12);

    // O mês de férias substitui um salário: 11 líquidos + o líquido das férias.
    const annualNet = round2(monthlyNet * 11 + vacation.net + thirteenth.net + fgtsTotal + benefits);

    return {
        salary, inss, irrf, monthlyNet, thirteenth, vacation,
        fgtsMonthly, fgtsYear, fgtsFine, fgtsTotal, benefits,
        annualNet, monthlyAverage: round2(annualNet / 12)
    };
}

/* Acha a menor entrada cujo líquido anual alcança o alvo.

   As curvas crescem com a entrada, mas não são monótonas: quando o lucro passa de
   R$ 50 mil/mês, o IRRF de 10% incide sobre o total distribuído e derruba o líquido
   de uma vez (Lei nº 15.270/2025). Nessa faixa o mesmo alvo tem dois faturamentos
   possíveis, e a bissecção pura pode devolver o maior. Por isso a varredura grossa
   primeiro isola o primeiro cruzamento; a bissecção só refina dentro dele. */
const SOLVER_STEPS = 1000;

function solveForTarget(target, evaluate, upperBound) {
    if (target <= 0) return {value: 0, exceeded: false};

    let low = 0, high = -1;
    for (let step = 1; step <= SOLVER_STEPS; step++) {
        const point = upperBound * step / SOLVER_STEPS;
        if (evaluate(point) >= target) {
            high = point;
            break;
        }
        low = point;
    }
    if (high < 0) return {value: upperBound, exceeded: true};

    for (let i = 0; i < 60; i++) {
        const mid = (low + high) / 2;
        if (evaluate(mid) < target) low = mid; else high = mid;
    }
    return {value: round2((low + high) / 2), exceeded: false};
}

const PJ_INVOICE_CEILING = 500000;   // R$/mês; acima disso o Simples já não cabe
const CLT_SALARY_CEILING = 300000;   // R$/mês

/* "Quanto preciso faturar como PJ para empatar com X de salário CLT?" */
function computeCltToPj(input, params) {
    const clt = computeCltPackage(input, params);
    const solved = solveForTarget(clt.annualNet,
        (invoice) => computePj({...input, monthlyInvoice: invoice}, params).annualNet, PJ_INVOICE_CEILING);
    const pj = computePj({...input, monthlyInvoice: solved.value}, params);
    return {direction: "clt-to-pj", clt, pj, answer: solved.value, exceeded: solved.exceeded};
}

/* "Qual salário CLT equivale a X de faturamento PJ?" */
function computePjToClt(input, params) {
    const pj = computePj(input, params);
    const solved = solveForTarget(pj.annualNet,
        (salary) => computeCltPackage({...input, salary}, params).annualNet, CLT_SALARY_CEILING);
    const clt = computeCltPackage({...input, salary: solved.value}, params);
    return {direction: "pj-to-clt", clt, pj, answer: solved.value, exceeded: solved.exceeded};
}

function computeEquivalence(input, params) {
    return input.direction === "pj-to-clt" ? computePjToClt(input, params) : computeCltToPj(input, params);
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
        alimony: {mode: $("#alimony-mode").value, value: parseCurrency($("#alimony-value").value)},
        privatePension: parseCurrency($("#private-pension").value),
        transport: {enabled: $("#transport-enabled").checked, cost: parseCurrency($("#transport-cost").value)},
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

function readThirteenthForm() {
    return {
        baseSalary: parseCurrency($("#th-base-salary").value),
        averages: parseCurrency($("#th-averages").value),
        months: parseInt($("#th-months").value, 10) || 12,
        irDependents: Math.max(0, parseInt($("#th-dependents").value, 10) || 0),
        alimony: {
            mode: $("#th-alimony-mode").value,
            value: $("#th-alimony-mode").value === "percent"
                ? (parseFloat($("#th-alimony-value").value.replace(",", ".")) || 0)
                : parseCurrency($("#th-alimony-value").value)
        }
    };
}

function readVacationForm() {
    return {
        baseSalary: parseCurrency($("#vac-base-salary").value),
        averages: parseCurrency($("#vac-averages").value),
        days: parseInt($("#vac-days").value, 10) || 30,
        soldDays: parseInt($("#vac-sold-days").value, 10) || 0,
        advanceThirteenth: $("#vac-advance-13th").checked,
        irDependents: Math.max(0, parseInt($("#vac-dependents").value, 10) || 0),
        alimony: {
            mode: $("#vac-alimony-mode").value,
            value: $("#vac-alimony-mode").value === "percent"
                ? (parseFloat($("#vac-alimony-value").value.replace(",", ".")) || 0)
                : parseCurrency($("#vac-alimony-value").value)
        }
    };
}

function readSeveranceForm() {
    return {
        baseSalary: parseCurrency($("#sev-base-salary").value),
        averages: parseCurrency($("#sev-averages").value),
        admissionDate: $("#sev-admission").value,
        terminationDate: $("#sev-termination").value,
        type: $("#sev-type").value,
        employerNotice: $("#sev-notice-employer").value,
        employeeNotice: $("#sev-notice-employee").value,
        contractEndDate: $("#sev-contract-end").value,
        expiredPeriods: Math.max(0, parseInt($("#sev-expired-periods").value, 10) || 0),
        expiredDouble: $("#sev-expired-double").checked,
        fgtsBalance: parseCurrency($("#sev-fgts-balance").value),
        fgtsWithdrawn: parseCurrency($("#sev-fgts-withdrawn").value),
        irDependents: Math.max(0, parseInt($("#sev-dependents").value, 10) || 0),
        unemploymentRequest: parseInt($("#sev-request").value, 10) || 1
    };
}

function readPjForm() {
    const proLaboreMode = $("#pj-prolabore-mode").value;
    return {
        direction: $("#pj-direction").value,
        salary: parseCurrency($("#pj-clt-salary").value),
        monthlyInvoice: parseCurrency($("#pj-invoice").value),
        irDependents: Math.max(0, parseInt($("#pj-dependents").value, 10) || 0),
        benefits: parseCurrency($("#pj-benefits").value),
        countFgts: $("#pj-count-fgts").checked,
        countFgtsFine: $("#pj-count-fgts-fine").checked,
        annex: $("#pj-annex").value,
        proLaboreMode,
        proLaboreValue: proLaboreMode === "percent"
            ? (parseFloat($("#pj-prolabore-value").value.replace(",", ".")) || 0)
            : parseCurrency($("#pj-prolabore-value").value),
        accountingFee: parseCurrency($("#pj-accounting").value),
        otherExpenses: parseCurrency($("#pj-expenses").value),
        billedMonths: Math.min(12, Math.max(1, parseInt($("#pj-billed-months").value, 10) || 12))
    };
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
        ["#inss-rate", "#irrf-rate", "#deductions-rate", "#fgts-amount"].forEach(id => {
            $(id).textContent = "…";
        });
        $("#calc-memo").innerHTML = "";
        return;
    }

    const result = computePayroll(input, activeParams);

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

    html += inssMemoHtml(result.inss, result.inssBase);
    html += irrfMemoHtml(result.irrf, "rendimento tributável", "INSS + dependentes + pensão + PGBL");

    if (input.familyChildren > 0) {
        html += `<h3>Salário-família</h3><p>${result.familyEligible
            ? `Remuneração R$ ${formatNumber(result.inssBase)} dentro do limite de R$ ${formatNumber(activeParams.familyAllowance.incomeLimit)} → ${input.familyChildren} × R$ ${formatNumber(activeParams.familyAllowance.quota)} = <b>R$ ${formatNumber(result.familyAmount)}</b>`
            : `Remuneração R$ ${formatNumber(result.inssBase)} acima do limite de R$ ${formatNumber(activeParams.familyAllowance.incomeLimit)} → sem direito no mês.`}</p>`;
    }

    html += `<h3>FGTS (depósito do empregador)</h3>
    <p class="formula">R$ ${formatNumber(result.fgtsBase)} × ${activeParams.fgtsRate.toLocaleString("pt-BR")}% = R$ ${formatNumber(result.fgtsAmount)}</p>`;

    $("#calc-memo").innerHTML = html;
}

/* ===================== blocos comuns da memória de cálculo ===================== */
function inssMemoHtml(inss, base) {
    let html = `<h3>INSS sobre base de R$ ${formatNumber(base)}${inss.capped ? ` (limitada ao teto de R$ ${formatNumber(inss.ceiling)})` : ""}</h3><table>`;
    for (const step of inss.steps) {
        html += `<tr><td>${formatNumber(step.from)} a ${formatNumber(step.to)}</td>` +
            `<td>× ${step.rate.toLocaleString("pt-BR")}%</td><td>${formatNumber(step.amount)}</td></tr>`;
    }
    return html + `<tr><td colspan="2"><b>Total INSS</b></td><td><b>${formatNumber(inss.total)}</b></td></tr></table>`;
}

function irrfMemoHtml(irrf, incomeLabel, deductionsLabel) {
    const chosen = (method) => irrf.method === method ? "chosen" : "";
    let html = `<h3>IRRF sobre ${incomeLabel} de R$ ${formatNumber(irrf.taxableIncome)}</h3>
    <p>Deduções legais (${deductionsLabel}) = R$ ${formatNumber(irrf.legalDeductions)} → base R$ ${formatNumber(irrf.legalBase)} → imposto <span class="${chosen("legal")}">R$ ${formatNumber(irrf.legalTax)}</span></p>
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
    return html + `<p><b>IRRF final: R$ ${formatNumber(irrf.total)}</b></p>`;
}

/* Linhas do demonstrativo no mesmo padrão visual do holerite mensal. */
function paycheckRowHtml(label, ref, amount, kind) {
    const value = `<td class="col-num ${kind}">${formatNumber(amount)}</td>`;
    return `<tr><td>${escapeHtml(label)}</td><td class="col-ref">${escapeHtml(ref)}</td>` +
        (kind === "earning" ? value + `<td class="col-num"></td>` : `<td class="col-num"></td>` + value) + `</tr>`;
}

/* ===================== 13º salário: renderização ===================== */
function renderThirteenth() {
    const input = readThirteenthForm();
    if (input.baseSalary <= 0) {
        $("#th-body").innerHTML =
            `<tr><td colspan="4" class="empty-state">Informe o salário base para simular o 13º.</td></tr>`;
        $("#th-months-echo").textContent = "…";
        $("#th-total-earnings").textContent = "…";
        $("#th-total-deductions").textContent = "…";
        setNetSalary($("#th-net"), 0);
        ["#th-first", "#th-second", "#th-deductions", "#th-fgts"].forEach(id => {
            $(id).textContent = "…";
        });
        $("#th-memo").innerHTML = "";
        return;
    }

    const result = computeThirteenth(input, activeParams);
    let rowsHtml = paycheckRowHtml("13º salário integral", `${result.months}/12`, result.gross, "earning");
    rowsHtml += paycheckRowHtml("INSS sobre o 13º",
        formatPercent(result.gross > 0 ? result.inss.total / result.gross * 100 : 0), result.inss.total, "deduction");
    rowsHtml += paycheckRowHtml("IRRF sobre o 13º (exclusivo na fonte)",
        result.irrf.total > 0 ? formatPercent(result.irrf.total / result.gross * 100) : "isento", result.irrf.total, "deduction");
    if (result.alimonyAmount > 0.004) {
        rowsHtml += paycheckRowHtml("Pensão alimentícia sobre o 13º",
            input.alimony.mode === "percent" ? formatPercent(input.alimony.value) : "", result.alimonyAmount, "deduction");
    }
    $("#th-body").innerHTML = rowsHtml;

    $("#th-months-echo").textContent = `${result.months}/12 avos`;
    $("#th-total-earnings").textContent = formatNumber(result.gross);
    $("#th-total-deductions").textContent = formatNumber(result.totalDeductions);
    setNetSalary($("#th-net"), result.net);
    $("#th-first").textContent = formatCurrency(result.firstInstallment);
    $("#th-second").textContent = formatCurrency(result.secondInstallment);
    $("#th-deductions").textContent = formatCurrency(result.totalDeductions);
    $("#th-fgts").textContent = formatCurrency(result.fgtsAmount);

    let memo = `<h3>Valor integral (Lei 4.090/1962)</h3>
    <p class="formula">(salário ${formatNumber(input.baseSalary)}${input.averages > 0 ? ` + médias ${formatNumber(input.averages)}` : ""}) ÷ 12 × ${result.months} avos = R$ ${formatNumber(result.gross)}</p>`;
    memo += inssMemoHtml(result.inss, result.gross);
    memo += `<p>Cálculo em separado da folha do mês (Lei 8.212/1991, art. 28, § 7º), retido na 2ª parcela.</p>`;
    memo += irrfMemoHtml(result.irrf, "o 13º integral", "INSS + dependentes + pensão");
    memo += `<h3>Parcelas (Lei 4.749/1965)</h3>
    <p class="formula">1ª parcela (até 30/11, sem descontos) = ${formatNumber(result.gross)} ÷ 2 = R$ ${formatNumber(result.firstInstallment)}</p>
    <p class="formula">2ª parcela (até 20/12) = ${formatNumber(result.gross)} − INSS ${formatNumber(result.inss.total)} − IRRF ${formatNumber(result.irrf.total)}${result.alimonyAmount > 0 ? ` − pensão ${formatNumber(result.alimonyAmount)}` : ""} − 1ª parcela = R$ ${formatNumber(result.secondInstallment)}</p>`;
    memo += `<h3>FGTS (depósito do empregador)</h3>
    <p class="formula">R$ ${formatNumber(result.gross)} × ${activeParams.fgtsRate.toLocaleString("pt-BR")}% = R$ ${formatNumber(result.fgtsAmount)}</p>`;
    $("#th-memo").innerHTML = memo;
}

/* ===================== férias: renderização ===================== */
function renderVacation() {
    const input = readVacationForm();
    if (input.baseSalary <= 0) {
        $("#vac-body").innerHTML =
            `<tr><td colspan="4" class="empty-state">Informe o salário base para simular as férias.</td></tr>`;
        $("#vac-days-echo").textContent = "…";
        $("#vac-total-earnings").textContent = "…";
        $("#vac-total-deductions").textContent = "…";
        setNetSalary($("#vac-net"), 0);
        ["#vac-taxable", "#vac-abono", "#vac-deductions", "#vac-fgts"].forEach(id => {
            $(id).textContent = "…";
        });
        $("#vac-memo").innerHTML = "";
        return;
    }

    const result = computeVacation(input, activeParams);
    let rowsHtml = paycheckRowHtml(`Férias (${result.restDays} dias)`, `${result.restDays}d`, result.vacationPay, "earning");
    rowsHtml += paycheckRowHtml("1/3 constitucional sobre férias", "⅓", result.vacationThird, "earning");
    if (result.soldDays > 0) {
        rowsHtml += paycheckRowHtml(`Abono pecuniário (${result.soldDays} dias vendidos)`, `${result.soldDays}d`, result.abonoPay, "earning");
        rowsHtml += paycheckRowHtml("1/3 sobre o abono pecuniário", "⅓", result.abonoThird, "earning");
    }
    if (result.thirteenthAdvance > 0) {
        rowsHtml += paycheckRowHtml("Adiantamento da 1ª parcela do 13º", "50%", result.thirteenthAdvance, "earning");
    }
    rowsHtml += paycheckRowHtml("INSS sobre férias + 1/3",
        formatPercent(result.taxableGross > 0 ? result.inss.total / result.taxableGross * 100 : 0), result.inss.total, "deduction");
    rowsHtml += paycheckRowHtml("IRRF sobre férias + 1/3",
        result.irrf.total > 0 ? formatPercent(result.irrf.total / result.taxableGross * 100) : "isento", result.irrf.total, "deduction");
    if (result.alimonyAmount > 0.004) {
        rowsHtml += paycheckRowHtml("Pensão alimentícia sobre férias",
            input.alimony.mode === "percent" ? formatPercent(input.alimony.value) : "", result.alimonyAmount, "deduction");
    }
    $("#vac-body").innerHTML = rowsHtml;

    $("#vac-days-echo").textContent = `${result.restDays}d gozados${result.soldDays > 0 ? ` + ${result.soldDays}d vendidos` : ""}`;
    $("#vac-total-earnings").textContent = formatNumber(result.totalEarnings);
    $("#vac-total-deductions").textContent = formatNumber(result.totalDeductions);
    setNetSalary($("#vac-net"), result.net);
    $("#vac-taxable").textContent = formatCurrency(result.taxableGross);
    $("#vac-abono").textContent = formatCurrency(round2(result.abonoPay + result.abonoThird));
    $("#vac-deductions").textContent = formatCurrency(result.totalDeductions);
    $("#vac-fgts").textContent = formatCurrency(result.fgtsAmount);

    let memo = `<h3>Remuneração das férias</h3>
    <p class="formula">(salário ${formatNumber(input.baseSalary)}${input.averages > 0 ? ` + médias ${formatNumber(input.averages)}` : ""}) ÷ 30 × ${result.restDays} dias = R$ ${formatNumber(result.vacationPay)} + 1/3 de R$ ${formatNumber(result.vacationThird)} = R$ ${formatNumber(result.taxableGross)}</p>`;
    if (result.soldDays > 0) {
        memo += `<h3>Abono pecuniário (CLT, art. 143)</h3>
      <p class="formula">${result.soldDays} dias × R$ ${formatNumber(result.base / 30)}/dia = R$ ${formatNumber(result.abonoPay)} + 1/3 de R$ ${formatNumber(result.abonoThird)}</p>
      <p>Verba isenta: não entra na base do INSS (Lei 8.212/1991, art. 28, § 9º), do IRRF (IN RFB 1.500/2014, art. 62) nem do FGTS.</p>`;
    }
    memo += inssMemoHtml(result.inss, result.taxableGross);
    memo += irrfMemoHtml(result.irrf, "férias + 1/3", "INSS + dependentes + pensão");
    memo += `<p>Férias são tributadas em separado dos demais rendimentos do mês (RIR/2018, art. 682).</p>`;
    if (result.thirteenthAdvance > 0) {
        memo += `<h3>Adiantamento do 13º (Lei 4.749/1965, art. 2º, § 2º)</h3>
      <p class="formula">50% de R$ ${formatNumber(result.base)} = R$ ${formatNumber(result.thirteenthAdvance)}</p>
      <p>Pago sem descontos; INSS e IRRF do 13º são retidos na 2ª parcela, em dezembro.</p>`;
    }
    memo += `<h3>FGTS (depósito do empregador)</h3>
    <p class="formula">R$ ${formatNumber(result.taxableGross)} × ${activeParams.fgtsRate.toLocaleString("pt-BR")}% = R$ ${formatNumber(result.fgtsVacation)}</p>`;
    if (result.fgtsAdvance > 0) {
        memo += `<p class="formula">+ adiantamento do 13º: R$ ${formatNumber(result.thirteenthAdvance)} × ${activeParams.fgtsRate.toLocaleString("pt-BR")}% = R$ ${formatNumber(result.fgtsAdvance)}</p>`;
    }
    $("#vac-memo").innerHTML = memo;
}

/* ===================== rescisão: renderização ===================== */
const SEVERANCE_TYPE_SHORT = {
    "no-cause": "sem justa causa", "agreement": "acordo (484-A)", "resignation": "pedido de demissão",
    "with-cause": "justa causa", "indirect": "rescisão indireta", "mutual-fault": "culpa recíproca",
    "term-end": "fim do contrato a termo", "term-early-employer": "antecipada pelo empregador",
    "term-early-employee": "antecipada pelo empregado", "death": "falecimento"
};

/* Mostra apenas os campos que fazem sentido para a modalidade escolhida. */
function syncSeveranceFields() {
    const rules = SEVERANCE_RULES[$("#sev-type").value] || SEVERANCE_RULES["no-cause"];
    $("#sev-notice-employer-field").classList.toggle("hidden", rules.notice !== "employer");
    $("#sev-notice-employee-field").classList.toggle("hidden", rules.notice !== "employee");
    $("#sev-contract-end-field").classList.toggle("hidden", !rules.indemnity479 && !rules.indemnity480);
    $("#sev-request-field").classList.toggle("hidden", !rules.unemployment);
}

function formatDateBr(date) {
    return date ? date.toLocaleDateString("pt-BR") : "";
}

function renderSeverance() {
    syncSeveranceFields();
    const input = readSeveranceForm();
    $("#sev-type-echo").textContent = SEVERANCE_TYPE_SHORT[input.type] || "…";
    const result = computeSeverance(input, activeParams);

    if (!result) {
        const admission = parseIsoDate(input.admissionDate);
        const termination = parseIsoDate(input.terminationDate);
        const message = admission && termination && termination < admission
            ? "O último dia de trabalho precisa ser igual ou posterior à admissão."
            : "Informe o salário, a data de admissão e o último dia de trabalho.";
        $("#sev-body").innerHTML = `<tr><td colspan="4" class="empty-state">${message}</td></tr>`;
        $("#sev-extra-body").innerHTML = `<tr><td colspan="2" class="empty-state">Aguardando os dados do contrato.</td></tr>`;
        $("#sev-total-earnings").textContent = "…";
        $("#sev-total-deductions").textContent = "…";
        setNetSalary($("#sev-net"), 0);
        ["#sev-fgts-available", "#sev-fgts-fine", "#sev-unemployment", "#sev-grand-total"]
            .forEach(id => {
                $(id).textContent = "…";
            });
        $("#sev-months-echo").textContent = "…";
        $("#sev-memo").innerHTML = "";
        return;
    }

    const fmtDays = (days) => days.toLocaleString("pt-BR", {maximumFractionDigits: 1});
    let rowsHtml = paycheckRowHtml(`Saldo de salário (${result.balanceDays} dias)`, `${result.balanceDays}d`, result.salaryBalance, "earning");
    if (result.noticeAmount > 0.004) {
        rowsHtml += paycheckRowHtml(`Aviso prévio indenizado${result.noticePaidDays !== result.noticeDays ? " (metade)" : ""}`,
            `${fmtDays(result.noticePaidDays)}d`, result.noticeAmount, "earning");
    }
    if (result.thirteenthGross > 0.004) {
        rowsHtml += paycheckRowHtml(`13º salário proporcional${result.thirteenthFactor !== 1 ? " (metade)" : ""}`,
            `${result.thirteenthTwelfths}/12`, result.thirteenthGross, "earning");
    }
    if (result.expiredVacation > 0.004) {
        rowsHtml += paycheckRowHtml(`Férias vencidas + 1/3${result.expiredDouble ? " (em dobro)" : ""}`,
            `${result.expiredPeriods}×`, result.expiredVacation, "earning");
    }
    if (result.proportionalVacation > 0.004) {
        rowsHtml += paycheckRowHtml(`Férias proporcionais${result.vacationFactor !== 1 ? " (metade)" : ""}`,
            `${result.vacationTwelfths}/12`, result.proportionalVacation, "earning");
        rowsHtml += paycheckRowHtml("1/3 constitucional sobre férias proporcionais", "⅓", result.proportionalThird, "earning");
    }
    if (result.earlyIndemnity > 0.004) {
        rowsHtml += paycheckRowHtml("Indenização de metade do prazo restante (art. 479)",
            `${result.remainingDays}d÷2`, result.earlyIndemnity, "earning");
    }
    rowsHtml += paycheckRowHtml("INSS sobre o saldo de salário",
        formatPercent(result.salaryBalance > 0 ? result.inssSalary.total / result.salaryBalance * 100 : 0),
        result.inssSalary.total, "deduction");
    if (result.irrfSalary.total > 0.004) {
        rowsHtml += paycheckRowHtml("IRRF sobre o saldo de salário",
            formatPercent(result.irrfSalary.total / result.salaryBalance * 100), result.irrfSalary.total, "deduction");
    }
    if (result.inssThirteenth.total > 0.004) {
        rowsHtml += paycheckRowHtml("INSS sobre o 13º (em separado)",
            formatPercent(result.inssThirteenth.total / result.thirteenthGross * 100), result.inssThirteenth.total, "deduction");
    }
    if (result.irrfThirteenth.total > 0.004) {
        rowsHtml += paycheckRowHtml("IRRF sobre o 13º (exclusivo na fonte)",
            formatPercent(result.irrfThirteenth.total / result.thirteenthGross * 100), result.irrfThirteenth.total, "deduction");
    }
    if (result.noticeDeduction > 0.004) {
        rowsHtml += paycheckRowHtml("Aviso prévio não cumprido (desconto)", "30d", result.noticeDeduction, "deduction");
    }
    $("#sev-body").innerHTML = rowsHtml;

    $("#sev-total-earnings").textContent = formatNumber(result.totalEarnings);
    $("#sev-total-deductions").textContent = formatNumber(result.totalDeductions);
    setNetSalary($("#sev-net"), result.net);

    const extraRow = (label, value, cls) =>
        `<tr><td>${escapeHtml(label)}</td><td class="col-num ${cls || ""}">${escapeHtml(value)}</td></tr>`;
    let extraHtml = extraRow(result.fgts.estimated
            ? `Saldo do FGTS estimado (${result.fgts.monthsWorked} meses)` : "Saldo do FGTS informado",
        formatCurrency(result.fgts.balance));
    if (result.fgts.withdrawn > 0) {
        extraHtml += extraRow("Saques anteriores (entram na base da multa)", formatCurrency(result.fgts.withdrawn));
    }
    extraHtml += extraRow(`Depósito sobre as verbas da rescisão (${activeParams.fgtsRate.toLocaleString("pt-BR")}%)`,
        formatCurrency(result.fgts.deposits));
    if (result.fgts.finePercent > 0) {
        extraHtml += extraRow(`Multa de ${result.fgts.finePercent.toLocaleString("pt-BR")}% sobre os depósitos`,
            formatCurrency(result.fgts.fine), "earning");
    }
    extraHtml += extraRow("Total na conta vinculada", formatCurrency(result.fgts.accountTotal));
    extraHtml += result.fgts.withdraw === "none"
        ? extraRow("Liberado para saque na rescisão", "R$ 0,00 (saldo fica na conta)")
        : extraRow(result.fgts.withdraw === "partial" ? "Liberado para saque (80% do total)" : "Liberado para saque",
            formatCurrency(result.fgts.available), "earning");
    if (!result.unemployment.eligible) {
        extraHtml += extraRow("Seguro-desemprego", "sem direito nesta modalidade");
    } else if (!result.unemployment.meetsMinimum) {
        extraHtml += extraRow("Seguro-desemprego",
            `carência não atingida (${result.unemployment.monthsCounted} de ${result.unemployment.minimumMonths} meses)`);
    } else {
        extraHtml += extraRow(`Seguro-desemprego (${result.unemployment.installments} parcelas)`,
            `${result.unemployment.installments} × ${formatCurrency(result.unemployment.installmentValue)} = ${formatCurrency(result.unemployment.total)}`,
            "earning");
    }
    $("#sev-extra-body").innerHTML = extraHtml;

    $("#sev-months-echo").textContent = `${result.fgts.monthsWorked} meses de contrato`;
    $("#sev-fgts-available").textContent = formatCurrency(result.fgts.available);
    $("#sev-fgts-fine").textContent = result.fgts.finePercent > 0 ? formatCurrency(result.fgts.fine) : "—";
    $("#sev-unemployment").textContent = result.unemployment.total > 0 ? formatCurrency(result.unemployment.total) : "—";
    $("#sev-grand-total").textContent = formatCurrency(result.grandTotal);

    renderSeveranceMemo(input, result);
}

function renderSeveranceMemo(input, result) {
    let html = `<h3>Saldo de salário</h3>
    <p class="formula">salário ${formatNumber(input.baseSalary)} ÷ 30 × ${result.balanceDays} dias = R$ ${formatNumber(result.salaryBalance)}</p>`;

    if (result.noticeStatus !== "none") {
        html += `<h3>Aviso prévio (Lei 12.506/2011)</h3>
      <p class="formula">30 + 3 × ${result.serviceYears} ano(s) completo(s) = ${result.noticeDays} dias (máx. 90)</p>`;
        if (result.noticeAmount > 0) {
            html += `<p class="formula">${result.noticePaidDays !== result.noticeDays ? `pela metade: ${result.noticeDays} ÷ 2 = ${result.noticePaidDays.toLocaleString("pt-BR")} dias → ` : ""}(salário + médias) ${formatNumber(result.base)} ÷ 30 × ${result.noticePaidDays.toLocaleString("pt-BR")} = R$ ${formatNumber(result.noticeAmount)}</p>
        <p>Verba indenizatória: sem INSS (STJ, Tema 478; IN RFB 2.110/2022, art. 34) e sem IRRF (Lei 7.713/1988, art. 6º, V), mas com depósito de FGTS (Súmula 305 do TST). A projeção estende o contrato até <b>${formatDateBr(result.projectedEnd)}</b> para contagem de 13º e férias (CLT, art. 487, § 1º).</p>`;
        } else if (result.noticeStatus === "worked") {
            html += `<p>Aviso trabalhado: os dias do aviso já são pagos como salário normal até o último dia (entram no saldo acima); não há verba adicional.</p>`;
        } else if (result.noticeStatus === "deducted") {
            html += `<p>Pedido de demissão sem cumprir o aviso: a empresa pode descontar 30 dias de salário (CLT, art. 487, § 2º) = <b>R$ ${formatNumber(result.noticeDeduction)}</b>.</p>`;
        } else {
            html += `<p>Aviso dispensado pela empresa: sem desconto e sem pagamento.</p>`;
        }
    }

    if (result.thirteenthGross > 0) {
        html += `<h3>13º proporcional (Lei 4.090/1962)</h3>
      <p class="formula">(salário + médias) ${formatNumber(result.base)} ÷ 12 × ${result.thirteenthTwelfths} avos${result.thirteenthFactor !== 1 ? " ÷ 2 (culpa recíproca, Súmula 14 do TST)" : ""} = R$ ${formatNumber(result.thirteenthGross)}</p>
      <p>Fração ≥ 15 dias no mês conta como avo, incluindo a projeção do aviso indenizado.</p>`;
        html += inssMemoHtml(result.inssThirteenth, result.thirteenthGross);
        html += irrfMemoHtml(result.irrfThirteenth, "o 13º da rescisão (exclusivo na fonte)", "INSS + dependentes");
    } else if (input.type === "with-cause") {
        html += `<h3>13º e férias proporcionais</h3>
      <p>Na justa causa o trabalhador <b>perde</b> o 13º proporcional (Lei 4.090/1962, art. 3º) e as férias proporcionais (Súmula 171 do TST); as férias vencidas continuam devidas (CLT, art. 146).</p>`;
    }

    if (result.expiredVacation > 0 || result.proportionalVacation > 0) {
        html += `<h3>Férias na rescisão (CLT, arts. 146 e 147)</h3>`;
        if (result.expiredVacation > 0) {
            html += `<p class="formula">vencidas: ${result.expiredPeriods} período(s) × (${formatNumber(result.base)} + 1/3)${result.expiredDouble ? " × 2 (dobra do art. 137)" : ""} = R$ ${formatNumber(result.expiredVacation)}</p>`;
        }
        if (result.proportionalVacation > 0) {
            html += `<p class="formula">proporcionais: ${formatNumber(result.base)} ÷ 12 × ${result.vacationTwelfths} avos${result.vacationFactor !== 1 ? " ÷ 2 (culpa recíproca)" : ""} = R$ ${formatNumber(result.proportionalVacation)} + 1/3 = R$ ${formatNumber(result.proportionalThird)}</p>`;
        }
        html += `<p>Férias pagas na rescisão (não gozadas) e o 1/3 são <b>isentas</b> de INSS (Lei 8.212/1991, art. 28, § 9º, “d”) e de IRRF (Súmulas 125 e 386 do STJ; IN RFB 1.500/2014, art. 62), sem depósito de FGTS.</p>`;
    }

    if (result.earlyIndemnity > 0) {
        html += `<h3>Indenização do art. 479 da CLT (contrato a termo)</h3>
      <p class="formula">${result.remainingDays} dias restantes ÷ 2 × R$ ${formatNumber(round2(result.base / 30))}/dia = R$ ${formatNumber(result.earlyIndemnity)}</p>
      <p>Devida quando o empregador encerra o contrato por prazo determinado antes do termo, salvo cláusula assecuratória de rescisão antecipada (art. 481).</p>`;
    }
    if (result.owesEmployerIndemnity) {
        html += `<h3>Rescisão antecipada pelo empregado (CLT, art. 480)</h3>
      <p>Havendo prejuízo comprovado, o empregado pode ter de indenizar o empregador em até <b>R$ ${formatNumber(round2(result.base / 30 * result.remainingDays / 2))}</b> (metade dos ${result.remainingDays} dias restantes). Não foi descontado nesta simulação.</p>`;
    }

    if (result.salaryBalance > 0) {
        html += inssMemoHtml(result.inssSalary, result.salaryBalance);
        html += irrfMemoHtml(result.irrfSalary, "o saldo de salário", "INSS + dependentes");
    }

    html += `<h3>FGTS (Lei 8.036/1990)</h3>`;
    html += result.fgts.estimated
        ? `<p class="formula">saldo estimado: ${formatNumber(result.base)} × ${activeParams.fgtsRate.toLocaleString("pt-BR")}% × (${result.fgts.monthsWorked} meses + 13º) = R$ ${formatNumber(result.fgts.balance)}</p>
      <p>Prefira informar o saldo real (app FGTS da CAIXA): juros, atualização monetária e variações salariais mudam o valor.</p>`
        : `<p>Saldo informado: R$ ${formatNumber(result.fgts.balance)}.</p>`;
    html += `<p class="formula">depósitos da rescisão: (saldo ${formatNumber(result.salaryBalance)}${result.thirteenthGross > 0 ? ` + 13º ${formatNumber(result.thirteenthGross)}` : ""}${result.noticeAmount > 0 ? ` + aviso ${formatNumber(result.noticeAmount)}` : ""}) × ${activeParams.fgtsRate.toLocaleString("pt-BR")}% = R$ ${formatNumber(result.fgts.deposits)}</p>`;
    if (result.fgts.finePercent > 0) {
        html += `<p class="formula">multa: ${result.fgts.finePercent.toLocaleString("pt-BR")}% × (${formatNumber(result.fgts.balance)}${result.fgts.withdrawn > 0 ? ` + sacados ${formatNumber(result.fgts.withdrawn)}` : ""} + ${formatNumber(result.fgts.deposits)}) = R$ ${formatNumber(result.fgts.fine)}</p>
      <p>A multa (art. 18, §§ 1º e 2º) incide sobre <b>todos os depósitos do contrato</b>, inclusive os já sacados, é depositada na conta vinculada e é isenta de INSS e IRRF.</p>`;
    }
    const withdrawText = {
        full: "saque integral do saldo + multa (Lei 8.036/1990, art. 20)",
        partial: "movimentação limitada a 80% do total da conta (CLT, art. 484-A, § 1º); os 20% restantes ficam retidos para as hipóteses do art. 20",
        none: "sem saque nesta modalidade — o saldo permanece na conta vinculada para as hipóteses do art. 20 (nova dispensa, aposentadoria, moradia etc.)"
    };
    html += `<p>Liberação: ${withdrawText[result.fgts.withdraw]}.</p>`;

    html += `<h3>Seguro-desemprego (Lei 7.998/1990; tabela MTE desde 11/01/2026)</h3>`;
    if (!result.unemployment.eligible) {
        html += `<p>Sem direito nesta modalidade: o benefício exige dispensa involuntária sem justa causa (inclui rescisão indireta e a rescisão antecipada do contrato a termo pelo empregador).</p>`;
    } else if (!result.unemployment.meetsMinimum) {
        html += `<p>Carência não atingida: a ${result.unemployment.request}ª solicitação exige ${result.unemployment.minimumMonths} meses de trabalho; o vínculo simulado tem ${result.unemployment.monthsCounted} nos últimos 36. Vínculos anteriores podem completar a carência — confira no aplicativo da Carteira de Trabalho Digital.</p>`;
    } else {
        const table = activeParams.unemployment;
        const average = result.base;
        let bandText;
        if (average <= table.firstLimit) bandText = `${formatNumber(average)} × ${String(table.firstFactor).replace(".", ",")}`;
        else if (average <= table.secondLimit) bandText = `${formatNumber(table.secondBase)} + ${String(table.secondFactor).replace(".", ",")} × (${formatNumber(average)} − ${formatNumber(table.firstLimit)})`;
        else bandText = `acima de ${formatNumber(table.secondLimit)} → teto`;
        html += `<p class="formula">média salarial ${formatNumber(average)} → ${bandText} → parcela R$ ${formatNumber(result.unemployment.installmentValue)}</p>
      <p>${result.unemployment.monthsCounted} meses nos últimos 36, ${result.unemployment.request}ª solicitação → <b>${result.unemployment.installments} parcelas</b> (art. 4º, § 2º). A parcela fica entre o salário mínimo e o teto e é arredondada para o inteiro superior (§ 4º). Estimativa: considera só este vínculo e usa a remuneração informada como média dos 3 últimos salários.</p>`;
    }

    html += `<h3>Prazo de pagamento</h3>
    <p>As verbas rescisórias devem ser pagas em até <b>10 dias corridos</b> do término do contrato (CLT, art. 477, § 6º); o atraso gera multa de um salário em favor do trabalhador (§ 8º).</p>`;

    $("#sev-memo").innerHTML = html;
}

/* ===================== PJ × CLT: renderização ===================== */
const PJ_EMPTY_IDS = ["#pj-annex-chip", "#pj-rate-chip", "#pj-factor-chip", "#pj-burden-chip"];

/* kind: "earning"/"deduction" colorem os números, como na folha; "total" destaca a linha.
   Valores null viram "—" (sem contrapartida no outro regime); strings saem como estão. */
function pjRowHtml(label, cltValue, pjValue, kind) {
    const numberClass = kind === "earning" || kind === "deduction" ? " " + kind : "";
    const cell = (value) => value == null
        ? `<td class="col-num"><span class="muted">—</span></td>`
        : `<td class="col-num${numberClass}">${typeof value === "string" ? escapeHtml(value) : formatNumber(value)}</td>`;
    return `<tr${kind === "total" ? ` class="pj-total"` : ""}><td>${escapeHtml(label)}</td>` +
        cell(cltValue) + cell(pjValue) + `</tr>`;
}

function syncPjFields() {
    const direction = $("#pj-direction").value;
    $("#pj-clt-salary-field").classList.toggle("hidden", direction !== "clt-to-pj");
    $("#pj-invoice-field").classList.toggle("hidden", direction !== "pj-to-clt");
    const mode = $("#pj-prolabore-mode").value;
    $("#pj-prolabore-value-field").classList.toggle("hidden", mode !== "fixed" && mode !== "percent");
    $("#pj-count-fgts-fine").disabled = !$("#pj-count-fgts").checked;
}

function renderPj() {
    syncPjFields();
    const input = readPjForm();
    const given = input.direction === "pj-to-clt" ? input.monthlyInvoice : input.salary;
    if (given <= 0) {
        $("#pj-body").innerHTML = `<tr><td colspan="3" class="empty-state">${input.direction === "pj-to-clt"
            ? "Informe o faturamento mensal da PJ para achar o salário CLT equivalente."
            : "Informe o salário CLT para descobrir quanto faturar como PJ."}</td></tr>`;
        $("#pj-direction-echo").textContent = "…";
        $("#pj-answer-label").textContent = input.direction === "pj-to-clt"
            ? "Salário CLT equivalente" : "Faturamento PJ equivalente";
        setNetSalary($("#pj-answer"), 0);
        PJ_EMPTY_IDS.forEach(id => {
            $(id).textContent = "…";
        });
        $("#pj-memo").innerHTML = "";
        $("#pj-warning").classList.add("hidden");
        return;
    }

    const result = computeEquivalence(input, activeParams);
    const {clt, pj} = result;
    const toPj = result.direction === "clt-to-pj";

    $("#pj-direction-echo").textContent = toPj
        ? `CLT ${formatCurrency(clt.salary)} → PJ`
        : `PJ ${formatCurrency(pj.monthlyInvoice)} → CLT`;
    $("#pj-answer-label").textContent = toPj
        ? "Faturamento PJ equivalente (por mês faturado)"
        : "Salário CLT bruto equivalente";
    setNetSalary($("#pj-answer"), result.answer);

    let rows = pjRowHtml("Salário bruto (CLT) / faturamento (PJ)", clt.salary, pj.monthlyInvoice);
    rows += pjRowHtml("Meses com receita no ano", "12", String(pj.billedMonths));
    rows += pjRowHtml("Receita bruta anual", round2(clt.salary * 12), pj.annualInvoice);
    rows += pjRowHtml("13º salário (líquido)", clt.thirteenth.net, null);
    rows += pjRowHtml("Terço constitucional de férias", round2(clt.vacation.vacationThird), null);
    if (clt.fgtsTotal > 0) {
        rows += pjRowHtml(`FGTS depositado no ano${clt.fgtsFine > 0
            ? ` + multa de ${activeParams.severance.finePercent.toLocaleString("pt-BR")}%` : ""}`, clt.fgtsTotal, null);
    }
    if (clt.benefits > 0) rows += pjRowHtml("Benefícios no ano (VR/VA, saúde…)", clt.benefits, null);
    rows += pjRowHtml("DAS do Simples no ano", null, pj.annualDas, "deduction");
    rows += pjRowHtml("Pró-labore bruto no ano", null, pj.annualProLabore);
    rows += pjRowHtml("INSS no ano", round2(clt.inss.total * 12 + clt.thirteenth.inss.total),
        round2(pj.inssProLabore * 12), "deduction");
    rows += pjRowHtml("IRRF no ano", round2(clt.irrf.total * 12 + clt.thirteenth.irrf.total + clt.vacation.irrf.total),
        round2(pj.irrf.total * 12), "deduction");
    if (pj.annualDividendTax > 0) {
        rows += pjRowHtml(`IRRF de ${activeParams.pj.dividends.rate.toLocaleString("pt-BR")}% sobre lucros`,
            null, pj.annualDividendTax, "deduction");
    }
    if (pj.annualExpenses > 0) rows += pjRowHtml("Contador e despesas no ano", null, pj.annualExpenses, "deduction");
    rows += pjRowHtml("Lucro distribuído no ano", null, pj.annualProfit);
    rows += pjRowHtml("Líquido anual no bolso", clt.annualNet, pj.annualNet, "total");
    rows += pjRowHtml("Média mensal líquida (÷ 12)", clt.monthlyAverage, pj.monthlyNet, "total");
    $("#pj-body").innerHTML = rows;

    $("#pj-annex-chip").textContent = `Anexo ${pj.annex}`;
    $("#pj-rate-chip").textContent = formatPercent(pj.simples.rate * 100);
    $("#pj-factor-chip").textContent = formatPercent(pj.factorR * 100);
    $("#pj-burden-chip").textContent = formatPercent(pj.effectiveBurden);

    const warnings = [];
    if (pj.simples.exceedsLimit) {
        warnings.push(`O faturamento anual de R$ ${formatNumber(pj.annualInvoice)} passa do limite do Simples Nacional
      (R$ ${formatNumber(pj.simples.limit)}/ano). Nessa faixa a empresa migra para o Lucro Presumido ou Real, que esta
      simulação não cobre.`);
    }
    if (result.exceeded) warnings.push("Não foi possível achar equivalência dentro dos limites da simulação.");
    if (pj.annualProfit < 0) {
        warnings.push(`O faturamento não cobre pró-labore, DAS e despesas: o lucro anual ficou negativo
      (R$ ${formatNumber(pj.annualProfit)}).`);
    }
    if (input.annex === "III" && pj.factorRAnnex === "V") {
        warnings.push(`O Anexo III está forçado, mas o Fator R de ${formatPercent(pj.factorR * 100)} está abaixo de
      ${activeParams.pj.factorRThreshold.toLocaleString("pt-BR")}% — na prática a Receita aplicaria o Anexo V.
      Use "automático" ou aumente o pró-labore.`);
    }
    if (pj.taxedDividends) {
        warnings.push(`Os lucros passam de R$ ${formatNumber(activeParams.pj.dividends.monthlyExemption)}/mês:
      incide IRRF de ${activeParams.pj.dividends.rate.toLocaleString("pt-BR")}% sobre <b>todo</b> o valor distribuído no
      mês, não só sobre o excedente (Lei nº 15.270/2025).`);
    }
    const warningBox = $("#pj-warning");
    warningBox.classList.toggle("hidden", warnings.length === 0);
    warningBox.innerHTML = warnings.map(text => `<p>${text}</p>`).join("");

    $("#pj-memo").innerHTML = renderPjMemo(input, result);
}

function renderPjMemo(input, result) {
    const {clt, pj} = result;
    const params = activeParams;
    const pct = (value) => value.toLocaleString("pt-BR");

    let html = `<h3>Pacote CLT anual (o alvo a igualar)</h3>
    <p class="formula">11 × líquido ${formatNumber(clt.monthlyNet)} + mês de férias ${formatNumber(clt.vacation.net)} + 13º ${formatNumber(clt.thirteenth.net)}${clt.fgtsTotal > 0 ? ` + FGTS ${formatNumber(clt.fgtsTotal)}` : ""}${clt.benefits > 0 ? ` + benefícios ${formatNumber(clt.benefits)}` : ""} = R$ ${formatNumber(clt.annualNet)}/ano</p>
    <p>O mês de férias substitui um salário: por isso 11 líquidos mensais mais o líquido das férias com o terço
    constitucional (CF, art. 7º, XVII). ${clt.fgtsTotal > 0
        ? `O FGTS entra como dinheiro do trabalhador${clt.fgtsFine > 0 ? `, com a multa de ${pct(params.severance.finePercent)}% da dispensa sem justa causa` : ""}, ainda que só liberado nas hipóteses do art. 20 da Lei 8.036/1990.`
        : "O FGTS está fora da conta — marque a opção para incluí-lo."}</p>`;

    html += `<h3>Pró-labore</h3>`;
    const modeText = {
        minimum: `um salário mínimo (R$ ${formatNumber(params.minimumWage)})`,
        "factor-r": `${pct(params.pj.factorRThreshold)}% do faturamento — o mínimo para garantir o Anexo III`,
        percent: `${pct(input.proLaboreValue)}% do faturamento`,
        fixed: "valor fixo informado"
    }[input.proLaboreMode];
    html += `<p class="formula">pró-labore = ${modeText} = R$ ${formatNumber(pj.proLabore)}/mês</p>`;
    html += `<p class="formula">INSS = ${pct(params.pj.proLaboreInssRate)}% × ${formatNumber(pj.inssBase)} = R$ ${formatNumber(pj.inssProLabore)}/mês</p>
    <p>Contribuinte individual: 11% sobre o pró-labore, com base entre o salário mínimo e o teto de
    R$ ${formatNumber(params.inss.ceiling)} (Lei nº 8.212/1991, art. 21). A CPP patronal de 20% já está embutida no DAS
    dos anexos III e V, então não é cobrada à parte.</p>`;
    html += irrfMemoHtml(pj.irrf, "o pró-labore", "INSS + dependentes");

    html += `<h3>Fator R e enquadramento (LC 123/2006, art. 18, §§ 5º-J e 5º-M)</h3>
    <p class="formula">Fator R = folha 12 meses ${formatNumber(pj.annualProLabore)} ÷ RBT12 ${formatNumber(pj.annualInvoice)} = ${formatPercent(pj.factorR * 100)}</p>
    <p>${pj.factorR >= params.pj.factorRThreshold / 100
        ? `Como ficou em ${formatPercent(pj.factorR * 100)} (≥ ${pct(params.pj.factorRThreshold)}%), a empresa cai no <b>Anexo III</b>, de alíquotas menores.`
        : `Como ficou abaixo de ${pct(params.pj.factorRThreshold)}%, a empresa cai no <b>Anexo V</b>, mais caro.`}
    ${input.annex !== "auto" ? ` O anexo está <b>forçado no Anexo ${input.annex}</b> pelo formulário.` : ""}</p>`;

    const brackets = pj.annex === "III" ? params.pj.simples.annexIII : params.pj.simples.annexV;
    const bracket = brackets[Math.min(pj.simples.bracket, brackets.length) - 1];
    html += `<h3>DAS do Simples Nacional (Anexo ${pj.annex}, ${pj.simples.bracket}ª faixa)</h3>
    <p class="formula">alíquota efetiva = (RBT12 ${formatNumber(pj.annualInvoice)} × ${pct(bracket.rate)}% − ${formatNumber(bracket.deduction)}) ÷ ${formatNumber(pj.annualInvoice)} = ${formatPercent(pj.simples.rate * 100)}</p>
    <p class="formula">DAS = ${formatNumber(pj.monthlyInvoice)} × ${formatPercent(pj.simples.rate * 100)} = R$ ${formatNumber(pj.das)}/mês</p>
    <p>O RBT12 é a receita bruta dos 12 meses anteriores; aqui ela é projetada como
    ${pj.billedMonths} ${pj.billedMonths === 1 ? "mês faturado" : "meses faturados"} × R$ ${formatNumber(pj.monthlyInvoice)}
    em regime permanente. No primeiro ano a receita é proporcionalizada e a alíquota real tende a ser menor.</p>`;

    html += `<h3>Lucro distribuído</h3>
    <p class="formula">lucro anual = receita ${formatNumber(pj.annualInvoice)} − DAS ${formatNumber(pj.annualDas)} − pró-labore ${formatNumber(pj.annualProLabore)}${pj.annualExpenses > 0 ? ` − despesas ${formatNumber(pj.annualExpenses)}` : ""} = R$ ${formatNumber(pj.annualProfit)}</p>
    <p class="formula">distribuição mensal = ${formatNumber(pj.annualProfit)} ÷ 12 = R$ ${formatNumber(pj.monthlyProfit)}</p>`;
    html += pj.taxedDividends
        ? `<p class="formula">IRRF = ${formatNumber(pj.monthlyProfit)} × ${pct(params.pj.dividends.rate)}% = R$ ${formatNumber(pj.dividendTax)}/mês</p>
      <p>Desde 1º/01/2026, a distribuição da mesma PJ para a mesma pessoa física acima de
      R$ ${formatNumber(params.pj.dividends.monthlyExemption)} no mês sofre retenção de ${pct(params.pj.dividends.rate)}%
      sobre o <b>total</b> pago no mês (Lei nº 15.270/2025). Lucros apurados até 31/12/2025 com distribuição aprovada
      no mesmo prazo seguem isentos se pagos até 2028.</p>`
        : `<p>Distribuição de até R$ ${formatNumber(params.pj.dividends.monthlyExemption)}/mês por sócio segue
      <b>isenta</b> de IRRF (Lei nº 15.270/2025). Exige escrituração contábil regular que comprove o lucro.</p>`;

    html += `<h3>Resultado</h3>
    <p class="formula">líquido PJ = pró-labore líquido ${formatNumber(pj.netProLabore)} × 12 + lucro ${formatNumber(pj.annualProfit)}${pj.annualDividendTax > 0 ? ` − IRRF sobre lucros ${formatNumber(pj.annualDividendTax)}` : ""} = R$ ${formatNumber(pj.annualNet)}/ano</p>
    <p class="formula">${result.direction === "clt-to-pj"
        ? `faturar R$ ${formatNumber(pj.monthlyInvoice)}/mês como PJ ≈ salário CLT de R$ ${formatNumber(clt.salary)}`
        : `salário CLT de R$ ${formatNumber(clt.salary)} ≈ faturar R$ ${formatNumber(pj.monthlyInvoice)}/mês como PJ`}</p>
    <p>Carga total sobre o faturamento (DAS + INSS + IRRF): ${formatPercent(pj.effectiveBurden)}.
    O valor equivalente é encontrado por busca binária sobre o líquido anual dos dois lados.</p>`;

    html += `<h3>O que a conta não cobre</h3>
    <p>Do lado CLT ficam de fora direitos sem valor direto aqui: estabilidade, seguro-desemprego, aviso prévio,
    licenças remuneradas e o INSS integral do empregador. Do lado PJ ficam de fora ISS fixo de sociedades uniprofissionais,
    substituição tributária, custos de abertura da empresa, previdência privada para repor a aposentadoria e o risco de
    <b>pejotização</b> — se houver pessoalidade, subordinação, habitualidade e onerosidade, o vínculo pode ser
    reconhecido na Justiça do Trabalho (CLT, arts. 2º e 3º). Confirme o enquadramento e o anexo do seu CNAE com um
    contador.</p>`;
    return html;
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
    "advance-value", "advance-mode", "absence-days", "lost-rest-days",
    "th-base-salary", "th-averages", "th-months", "th-dependents", "th-alimony-value", "th-alimony-mode",
    "vac-base-salary", "vac-averages", "vac-days", "vac-sold-days", "vac-advance-13th",
    "vac-dependents", "vac-alimony-value", "vac-alimony-mode",
    "sev-base-salary", "sev-averages", "sev-admission", "sev-termination", "sev-type",
    "sev-notice-employer", "sev-notice-employee", "sev-contract-end",
    "sev-expired-periods", "sev-expired-double", "sev-fgts-balance", "sev-fgts-withdrawn",
    "sev-dependents", "sev-request",
    "pj-direction", "pj-clt-salary", "pj-invoice", "pj-dependents", "pj-benefits",
    "pj-count-fgts", "pj-count-fgts-fine", "pj-annex", "pj-prolabore-mode", "pj-prolabore-value",
    "pj-accounting", "pj-expenses", "pj-billed-months"];

function saveFormState() {
    const data = {};
    for (const id of FORM_FIELDS) {
        const element = document.getElementById(id);
        data[id] = element.type === "checkbox" ? element.checked : element.value;
    }
    data._earnings = readRawItems("#earnings-list", true);
    data._deductions = readRawItems("#deductions-list", false);
    try {
        localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data));
    } catch (_) { /* armazenamento indisponível */
    }
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
    try {
        data = JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || "null");
    } catch (_) {
        data = null;
    }
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

/* Migração: parâmetros salvos antes das abas Rescisão e PJ não tinham
   severance/unemployment/pj. */
function normalizeParams(params) {
    if (!params.severance) params.severance = JSON.parse(JSON.stringify(DEFAULT_PARAMS.severance));
    if (!params.unemployment) params.unemployment = JSON.parse(JSON.stringify(DEFAULT_PARAMS.unemployment));
    if (!params.pj) params.pj = JSON.parse(JSON.stringify(DEFAULT_PARAMS.pj));
    return params;
}

function loadParams() {
    try {
        const saved = JSON.parse(localStorage.getItem(PARAMS_STORAGE_KEY) || "null");
        if (saved && saved.inss && saved.irrf) return normalizeParams(saved);
    } catch (_) { /* usa padrões */
    }
    return JSON.parse(JSON.stringify(DEFAULT_PARAMS));
}

function hasCustomParams() {
    return JSON.stringify(activeParams) !== JSON.stringify(DEFAULT_PARAMS);
}

function updateBadges() {
    $("#params-badge").textContent = "Tabelas " + (activeParams.year || "?");
    $("#custom-badge").classList.toggle("hidden", !hasCustomParams());
}

/* Trava de edição dos parâmetros.
   A senha mestre não fica em texto puro no código: guardamos só o SHA-256 de (SALT + senha).
   É uma barreira contra edição acidental ou por terceiros no navegador — não é segurança
   criptográfica: o app é estático e roda inteiro no cliente. */
const MASTER_PASSWORD_SALT = "net-salary-calc:v1:";
const MASTER_PASSWORD_HASH = "cbda29c6bcecdaae8585e8ba95d3ed28f0c7a1857823a372fcbb72b6783c5932";

let settingsUnlocked = false;

// SHA-256 síncrono (FIPS 180-4); evita depender de crypto.subtle, que exige contexto seguro.
function sha256Hex(message) {
    const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const bytes = Array.from(new TextEncoder().encode(message));
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(Math.floor(bitLength / Math.pow(2, i * 8)) & 0xff);

    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    const w = new Uint32Array(64);
    for (let offset = 0; offset < bytes.length; offset += 64) {
        for (let i = 0; i < 16; i++) {
            const p = offset + i * 4;
            w[i] = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
        }
        for (let i = 16; i < 64; i++) {
            const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
            const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = H;
        for (let i = 0; i < 64; i++) {
            const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + s1 + ch + K[i] + w[i]) >>> 0;
            const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (s0 + maj) >>> 0;
            h = g;
            g = f;
            f = e;
            e = (d + t1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) >>> 0;
        }
        [a, b, c, d, e, f, g, h].forEach((value, index) => {
            H[index] = (H[index] + value) >>> 0;
        });
    }
    return H.map(value => value.toString(16).padStart(8, "0")).join("");
}

function isMasterPassword(value) {
    return sha256Hex(MASTER_PASSWORD_SALT + value) === MASTER_PASSWORD_HASH;
}

// Desabilita todos os controles da aba, exceto os da própria trava.
function applySettingsLock() {
    const lockPanel = $("#settings-lock");
    $$("#settings-view input, #settings-view button, #settings-view textarea").forEach(control => {
        if (lockPanel.contains(control)) return;
        control.disabled = !settingsUnlocked;
    });
    $("#settings-grid-wrap").classList.toggle("is-locked", !settingsUnlocked);
    $(".settings-actions").classList.toggle("is-locked", !settingsUnlocked);
    $("#settings-json").classList.toggle("is-locked", !settingsUnlocked);
    $("#unlock-settings").classList.toggle("hidden", settingsUnlocked);
    $("#master-password").classList.toggle("hidden", settingsUnlocked);
    $("#lock-settings").classList.toggle("hidden", !settingsUnlocked);
}

/* Faixas do Simples (RBT12 anual, alíquota nominal e parcela a deduzir). */
function renderSimplesTable(selector, brackets, key, label) {
    const body = $(selector);
    body.innerHTML = "";
    brackets.forEach((bracket, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td><input data-simples="${key}" data-index="${index}" data-key="upTo" value="${formatNumber(bracket.upTo)}" aria-label="${label}, faixa ${index + 1}, receita bruta até"></td>
      <td><input data-simples="${key}" data-index="${index}" data-key="rate" value="${String(bracket.rate).replace(".", ",")}" aria-label="${label}, alíquota nominal da faixa ${index + 1}"></td>
      <td><input data-simples="${key}" data-index="${index}" data-key="deduction" value="${formatNumber(bracket.deduction)}" aria-label="${label}, parcela a deduzir da faixa ${index + 1}"></td>`;
        body.appendChild(row);
    });
}

function readSimplesTable(selector) {
    return $$(selector + " tr").map(row => ({
        upTo: parseCurrency(row.querySelector('[data-key="upTo"]').value),
        rate: parseFloat(row.querySelector('[data-key="rate"]').value.replace(",", ".")) || 0,
        deduction: parseCurrency(row.querySelector('[data-key="deduction"]').value)
    })).filter(bracket => bracket.upTo > 0).sort((a, b) => a.upTo - b.upTo);
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

    renderSimplesTable("#simples-iii-body", activeParams.pj.simples.annexIII, "iii", "Anexo III");
    renderSimplesTable("#simples-v-body", activeParams.pj.simples.annexV, "v", "Anexo V");
    $("#prolabore-inss-rate").value = String(activeParams.pj.proLaboreInssRate).replace(".", ",");
    $("#factor-r-threshold").value = String(activeParams.pj.factorRThreshold).replace(".", ",");
    $("#dividend-rate").value = String(activeParams.pj.dividends.rate).replace(".", ",");
    $("#dividend-exemption").value = formatNumber(activeParams.pj.dividends.monthlyExemption);

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

    $("#notice-base-days").value = String(activeParams.severance.noticeBaseDays);
    $("#notice-per-year-days").value = String(activeParams.severance.noticePerYearDays);
    $("#notice-max-days").value = String(activeParams.severance.noticeMaxDays);
    $("#fgts-fine-percent").value = String(activeParams.severance.finePercent).replace(".", ",");
    $("#fgts-agreement-fine-percent").value = String(activeParams.severance.agreementFinePercent).replace(".", ",");
    $("#su-first-limit").value = formatNumber(activeParams.unemployment.firstLimit);
    $("#su-first-factor").value = String(activeParams.unemployment.firstFactor).replace(".", ",");
    $("#su-second-limit").value = formatNumber(activeParams.unemployment.secondLimit);
    $("#su-second-base").value = formatNumber(activeParams.unemployment.secondBase);
    $("#su-second-factor").value = String(activeParams.unemployment.secondFactor).replace(".", ",");
    $("#su-ceiling").value = formatNumber(activeParams.unemployment.ceiling);

    const maxInss = computeInss(activeParams.inss.ceiling, activeParams).total;
    $("#inss-note").textContent =
        `Teto (última faixa): R$ ${formatNumber(activeParams.inss.ceiling)}; contribuição máxima de R$ ${formatNumber(maxInss)}/mês.`;

    applySettingsLock();
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

    const annexIII = readSimplesTable("#simples-iii-body");
    const annexV = readSimplesTable("#simples-v-body");

    if (!inssBrackets.length || !irrfBrackets.length) {
        showSettingsError("As tabelas precisam de ao menos uma faixa válida.");
        return false;
    }
    if (!annexIII.length || !annexV.length) {
        showSettingsError("Os anexos III e V do Simples precisam de ao menos uma faixa válida.");
        return false;
    }

    activeParams = {
        year: $("#params-year").value.trim() || "?",
        minimumWage: parseCell($("#minimum-wage").value),
        inss: {ceiling: inssBrackets[inssBrackets.length - 1].upTo, brackets: inssBrackets},
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
        fgtsRate: parseFloat($("#fgts-rate-input").value.replace(",", ".")) || 0,
        severance: {
            noticeBaseDays: parseInt($("#notice-base-days").value, 10) || 30,
            noticePerYearDays: parseInt($("#notice-per-year-days").value, 10) || 0,
            noticeMaxDays: parseInt($("#notice-max-days").value, 10) || 90,
            finePercent: parseFloat($("#fgts-fine-percent").value.replace(",", ".")) || 0,
            agreementFinePercent: parseFloat($("#fgts-agreement-fine-percent").value.replace(",", ".")) || 0
        },
        unemployment: {
            firstLimit: parseCell($("#su-first-limit").value),
            firstFactor: parseFloat($("#su-first-factor").value.replace(",", ".")) || 0,
            secondLimit: parseCell($("#su-second-limit").value),
            secondBase: parseCell($("#su-second-base").value),
            secondFactor: parseFloat($("#su-second-factor").value.replace(",", ".")) || 0,
            ceiling: parseCell($("#su-ceiling").value)
        },
        pj: {
            proLaboreInssRate: parseFloat($("#prolabore-inss-rate").value.replace(",", ".")) || 0,
            factorRThreshold: parseFloat($("#factor-r-threshold").value.replace(",", ".")) || 0,
            dividends: {
                rate: parseFloat($("#dividend-rate").value.replace(",", ".")) || 0,
                monthlyExemption: parseCell($("#dividend-exemption").value)
            },
            simples: {annexIII, annexV}
        }
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
    try {
        saved = localStorage.getItem(THEME_STORAGE_KEY) || "auto";
    } catch (_) { /* segue no auto */
    }
    applyTheme(saved);
    $$(".theme-switch button").forEach(button => {
        button.addEventListener("click", () => {
            const choice = button.dataset.themeChoice;
            applyTheme(choice);
            try {
                if (choice === "auto") localStorage.removeItem(THEME_STORAGE_KEY);
                else localStorage.setItem(THEME_STORAGE_KEY, choice);
            } catch (_) { /* armazenamento indisponível */
            }
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
        optionEls[activeIndex].scrollIntoView({block: "nearest"});
    };

    const onDocPointer = (event) => {
        if (!wrap.contains(event.target)) close();
    };

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
            native.dispatchEvent(new Event("change", {bubbles: true}));
        }
        close();
        trigger.focus();
    }

    trigger.addEventListener("click", () => (wrap.classList.contains("open") ? close() : open()));
    trigger.addEventListener("keydown", (event) => {
        const isOpen = wrap.classList.contains("open");
        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                isOpen ? setActive(activeIndex + 1) : open();
                break;
            case "ArrowUp":
                event.preventDefault();
                isOpen ? setActive(activeIndex - 1) : open();
                break;
            case "Enter":
            case " ":
                event.preventDefault();
                isOpen ? choose(activeIndex) : open();
                break;
            case "Home":
                if (isOpen) {
                    event.preventDefault();
                    setActive(0);
                }
                break;
            case "End":
                if (isOpen) {
                    event.preventDefault();
                    setActive(optionEls.length - 1);
                }
                break;
            case "Escape":
                if (isOpen) {
                    event.preventDefault();
                    close();
                }
                break;
            case "Tab":
                close();
                break;
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
    prevBtn.type = "button";
    prevBtn.className = "month-nav";
    prevBtn.setAttribute("aria-label", "Ano anterior");
    prevBtn.innerHTML = CHEVRON_LEFT_SVG;
    const yearLabel = document.createElement("span");
    yearLabel.className = "month-year";
    yearLabel.setAttribute("aria-live", "polite");
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "month-nav";
    nextBtn.setAttribute("aria-label", "Próximo ano");
    nextBtn.innerHTML = CHEVRON_RIGHT_SVG;
    head.append(prevBtn, yearLabel, nextBtn);

    const grid = document.createElement("div");
    grid.className = "month-grid";
    const cells = MONTH_ABBR.map((abbr, i) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "month-cell";
        cell.textContent = abbr;
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
            ? {year: +match[1], month: +match[2]}
            : {year: todayYear, month: todayMonth};
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

    const onDocPointer = (event) => {
        if (!wrap.contains(event.target)) close();
    };

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
        state = {year: viewYear, month: monthIndex + 1};
        native.value = `${state.year}-${String(state.month).padStart(2, "0")}`;
        native.dispatchEvent(new Event("change", {bubbles: true}));
        renderLabel();
        close();
        trigger.focus();
    };

    trigger.addEventListener("click", () => (wrap.classList.contains("open") ? close() : open()));
    trigger.addEventListener("keydown", (event) => {
        if (["Enter", " ", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            open();
        } else if (event.key === "Escape") close();
    });
    prevBtn.addEventListener("click", () => {
        viewYear--;
        renderPanel();
    });
    nextBtn.addEventListener("click", () => {
        viewYear++;
        renderPanel();
    });
    cells.forEach((cell, i) => cell.addEventListener("click", () => pick(i)));
    panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            trigger.focus();
        }
    });
    // reflete mudanças programáticas do valor (init/restauração)
    native.addEventListener("change", () => {
        state = parseValue();
        renderLabel();
    });

    renderLabel();
}

/* ---------- seletor de data personalizado (substitui input[type=date]) ---------- */
const WEEKDAY_LETTERS = ["D", "S", "T", "Q", "Q", "S", "S"];

function toIsoDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/* Mesmo padrão do seletor de mês: o input nativo permanece como fonte de
   estado; o painel tem grade de dias, modo mês/ano (clique no título),
   e atalhos "Limpar" e "Hoje". */
function enhanceDatePicker(native) {
    if (native._dateEnhanced) return;
    native._dateEnhanced = true;

    const wrap = document.createElement("div");
    wrap.className = "month-picker date-picker";

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
    panel.className = "month-panel date-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Selecionar data");

    const head = document.createElement("div");
    head.className = "month-head";
    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "month-nav";
    prevBtn.setAttribute("aria-label", "Mês anterior");
    prevBtn.innerHTML = CHEVRON_LEFT_SVG;
    const title = document.createElement("button");
    title.type = "button";
    title.className = "date-title";
    title.setAttribute("aria-label", "Escolher mês e ano");
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "month-nav";
    nextBtn.setAttribute("aria-label", "Próximo mês");
    nextBtn.innerHTML = CHEVRON_RIGHT_SVG;
    head.append(prevBtn, title, nextBtn);

    const dows = document.createElement("div");
    dows.className = "date-dows";
    dows.setAttribute("aria-hidden", "true");
    WEEKDAY_LETTERS.forEach(letter => {
        const span = document.createElement("span");
        span.textContent = letter;
        dows.appendChild(span);
    });

    const dayGrid = document.createElement("div");
    dayGrid.className = "date-grid";
    const dayCells = Array.from({length: 42}, () => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "date-cell";
        dayGrid.appendChild(cell);
        return cell;
    });

    // Modo mês/ano: reaproveita a grade do seletor de mês.
    const monthGrid = document.createElement("div");
    monthGrid.className = "month-grid hidden";
    const monthCells = MONTH_ABBR.map((abbr, i) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "month-cell";
        cell.textContent = abbr;
        cell.setAttribute("aria-label", MONTH_NAMES[i]);
        monthGrid.appendChild(cell);
        return cell;
    });

    const foot = document.createElement("div");
    foot.className = "date-foot";
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn btn-small";
    clearBtn.textContent = "Limpar";
    const todayBtn = document.createElement("button");
    todayBtn.type = "button";
    todayBtn.className = "btn btn-small";
    todayBtn.textContent = "Hoje";
    foot.append(clearBtn, todayBtn);

    panel.append(head, dows, dayGrid, monthGrid, foot);

    native.parentNode.insertBefore(wrap, native);
    native.classList.add("select-native-hidden");
    native.setAttribute("tabindex", "-1");
    native.setAttribute("aria-hidden", "true");
    wrap.append(native, trigger, panel);

    const today = new Date();
    let viewYear = today.getFullYear(), viewMonth = today.getMonth();
    let monthMode = false;

    const selectedDate = () => parseIsoDate(native.value);

    const renderLabel = () => {
        const selected = selectedDate();
        valueSpan.textContent = selected ? selected.toLocaleDateString("pt-BR") : "dd/mm/aaaa";
        valueSpan.classList.toggle("placeholder", !selected);
    };

    const renderPanel = () => {
        title.textContent = monthMode ? String(viewYear) : `${MONTH_NAMES[viewMonth]} de ${viewYear}`;
        prevBtn.setAttribute("aria-label", monthMode ? "Ano anterior" : "Mês anterior");
        nextBtn.setAttribute("aria-label", monthMode ? "Próximo ano" : "Próximo mês");
        dows.classList.toggle("hidden", monthMode);
        dayGrid.classList.toggle("hidden", monthMode);
        monthGrid.classList.toggle("hidden", !monthMode);
        const selected = selectedDate();
        if (monthMode) {
            monthCells.forEach((cell, i) => {
                const isSelected = !!selected && selected.getFullYear() === viewYear && selected.getMonth() === i;
                cell.classList.toggle("selected", isSelected);
                cell.classList.toggle("today", viewYear === today.getFullYear() && i === today.getMonth());
                cell.setAttribute("aria-pressed", isSelected ? "true" : "false");
            });
            return;
        }
        // Grade fixa de 6 semanas iniciando no domingo anterior ao dia 1º.
        const first = new Date(viewYear, viewMonth, 1);
        const gridStart = addDays(first, -first.getDay());
        const selectedIso = selected ? toIsoDate(selected) : "";
        const todayIso = toIsoDate(today);
        dayCells.forEach((cell, i) => {
            const date = addDays(gridStart, i);
            const iso = toIsoDate(date);
            cell.textContent = String(date.getDate());
            cell.dataset.date = iso;
            cell.classList.toggle("other", date.getMonth() !== viewMonth);
            cell.classList.toggle("today", iso === todayIso);
            cell.classList.toggle("selected", iso === selectedIso);
            cell.setAttribute("aria-label", date.toLocaleDateString("pt-BR"));
            cell.setAttribute("aria-pressed", iso === selectedIso ? "true" : "false");
        });
    };

    const onDocPointer = (event) => {
        if (!wrap.contains(event.target)) close();
    };

    function open() {
        if (wrap.classList.contains("open")) return;
        const anchor = selectedDate() || today;   // re-sincroniza caso o valor tenha mudado por fora
        viewYear = anchor.getFullYear();
        viewMonth = anchor.getMonth();
        monthMode = false;
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

    const commit = (isoValue) => {
        native.value = isoValue;
        native.dispatchEvent(new Event("change", {bubbles: true}));
        renderLabel();
        close();
        trigger.focus();
    };

    trigger.addEventListener("click", () => (wrap.classList.contains("open") ? close() : open()));
    trigger.addEventListener("keydown", (event) => {
        if (["Enter", " ", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            open();
        } else if (event.key === "Escape") close();
    });
    title.addEventListener("click", () => {
        monthMode = !monthMode;
        renderPanel();
    });
    prevBtn.addEventListener("click", () => {
        if (monthMode) viewYear--;
        else if (--viewMonth < 0) {
            viewMonth = 11;
            viewYear--;
        }
        renderPanel();
    });
    nextBtn.addEventListener("click", () => {
        if (monthMode) viewYear++;
        else if (++viewMonth > 11) {
            viewMonth = 0;
            viewYear++;
        }
        renderPanel();
    });
    dayCells.forEach(cell => cell.addEventListener("click", () => commit(cell.dataset.date)));
    monthCells.forEach((cell, i) => cell.addEventListener("click", () => {
        viewMonth = i;
        monthMode = false;
        renderPanel();
    }));
    clearBtn.addEventListener("click", () => commit(""));
    todayBtn.addEventListener("click", () => commit(toIsoDate(today)));
    panel.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            close();
            trigger.focus();
        }
    });
    native.addEventListener("change", renderLabel); // reflete mudanças programáticas (restauração/limpar)

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
        input.dispatchEvent(new Event("input", {bubbles: true}));
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
        else {
            element._netValue = to;
            element.textContent = formatCurrency(to);
            element._raf = null;
        }
    };
    element._raf = requestAnimationFrame(tick);
}

/* Aplica todos os componentes personalizados aos formulários (calculadora
   mensal, 13º salário e férias). */
function enhanceControls() {
    $$("form select").forEach(enhanceSelect);
    $$("form input[type='month']").forEach(enhanceMonthPicker);
    $$("form input[type='date']").forEach(enhanceDatePicker);
    $$("form .money-input").forEach(enhanceMoneyField);
    $$("form input[type='number']").forEach(enhanceStepper);
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
        ? `= ${formatHoursLabel(value)} (${value.toLocaleString("pt-BR", {maximumFractionDigits: 4})} h)`
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

    // Abas 13º salário e férias: mesma mecânica da calculadora mensal.
    const handleThirteenthChange = () => {
        saveFormState();
        renderThirteenth();
    };
    $("#thirteenth-form").addEventListener("input", handleThirteenthChange);
    $("#thirteenth-form").addEventListener("change", handleThirteenthChange);
    const handleVacationChange = () => {
        saveFormState();
        renderVacation();
    };
    $("#vacation-form").addEventListener("input", handleVacationChange);
    $("#vacation-form").addEventListener("change", handleVacationChange);
    const handleSeveranceChange = () => {
        saveFormState();
        renderSeverance();
    };
    $("#severance-form").addEventListener("input", handleSeveranceChange);
    $("#severance-form").addEventListener("change", handleSeveranceChange);
    const handlePjChange = () => {
        saveFormState();
        renderPj();
    };
    $("#pj-form").addEventListener("input", handlePjChange);
    $("#pj-form").addEventListener("change", handlePjChange);

    $("#th-clear").addEventListener("click", () => {
        if (!confirm("Limpar os campos do 13º salário?")) return;
        ["th-base-salary", "th-averages", "th-alimony-value"].forEach(id => {
            $("#" + id).value = "";
        });
        $("#th-months").value = "12";
        $("#th-dependents").value = "0";
        $("#th-alimony-mode").value = "fixed";
        $("#th-alimony-mode").dispatchEvent(new Event("change", {bubbles: true}));
    });

    $("#vac-clear").addEventListener("click", () => {
        if (!confirm("Limpar os campos de férias?")) return;
        ["vac-base-salary", "vac-averages", "vac-alimony-value"].forEach(id => {
            $("#" + id).value = "";
        });
        $("#vac-days").value = "30";
        $("#vac-sold-days").value = "0";
        $("#vac-dependents").value = "0";
        $("#vac-advance-13th").checked = false;
        $("#vac-alimony-mode").value = "fixed";
        $("#vac-alimony-mode").dispatchEvent(new Event("change", {bubbles: true}));
    });

    $("#sev-clear").addEventListener("click", () => {
        if (!confirm("Limpar os campos da rescisão?")) return;
        ["sev-base-salary", "sev-averages", "sev-admission", "sev-termination",
            "sev-contract-end", "sev-fgts-balance", "sev-fgts-withdrawn"].forEach(id => {
            $("#" + id).value = "";
        });
        $("#sev-expired-periods").value = "0";
        $("#sev-dependents").value = "0";
        $("#sev-expired-double").checked = false;
        $("#sev-type").value = "no-cause";
        $("#sev-notice-employer").value = "indemnified";
        $("#sev-notice-employee").value = "worked";
        $("#sev-request").value = "1";
        // Ressincroniza selects e seletores de data personalizados; o change
        // também salva e re-renderiza.
        ["sev-type", "sev-notice-employer", "sev-notice-employee", "sev-request",
            "sev-admission", "sev-termination", "sev-contract-end"]
            .forEach(id => $("#" + id).dispatchEvent(new Event("change", {bubbles: true})));
    });

    $("#pj-clear").addEventListener("click", () => {
        if (!confirm("Limpar os campos da simulação PJ?")) return;
        ["pj-clt-salary", "pj-invoice", "pj-benefits", "pj-prolabore-value"].forEach(id => {
            $("#" + id).value = "";
        });
        $("#pj-dependents").value = "0";
        $("#pj-accounting").value = "";
        $("#pj-expenses").value = "";
        $("#pj-billed-months").value = "12";
        $("#pj-count-fgts").checked = true;
        $("#pj-count-fgts-fine").checked = false;
        $("#pj-direction").value = "clt-to-pj";
        $("#pj-annex").value = "auto";
        $("#pj-prolabore-mode").value = "factor-r";
        // Ressincroniza os selects personalizados; o change também salva e re-renderiza.
        ["pj-direction", "pj-annex", "pj-prolabore-mode"]
            .forEach(id => $("#" + id).dispatchEvent(new Event("change", {bubbles: true})));
    });

    $("#clear-form").addEventListener("click", () => {
        if (!confirm("Limpar todos os campos preenchidos?")) return;
        // Limpa todos os inputs de texto/número, inclusive os sem type explícito
        // (moeda e horas): a checagem por .type resolve o default "text".
        $$("#payroll-form input").forEach(element => {
            if (element.type === "checkbox" || element.type === "month") return;
            element.value = element.id === "night-rate" ? "20" : "";
        });
        ["ir-dependents", "family-children", "absence-days", "lost-rest-days"].forEach(id => {
            $("#" + id).value = "0";
        });
        $$("#payroll-form input[type='checkbox']").forEach(element => {
            element.checked = element.id === "dsr-enabled";
        });
        $("#work-schedule").value = "220";
        $("#custom-schedule-field").classList.add("hidden");
        $("#alimony-mode").value = "fixed";
        $("#advance-mode").value = "fixed";
        $("#unhealthy-level").value = "0";
        $("#unhealthy-base").value = "minimum-wage";
        // Ressincroniza os selects personalizados e reformata os campos de modo duplo.
        ["work-schedule", "alimony-mode", "advance-mode", "unhealthy-level", "unhealthy-base"]
            .forEach(id => $("#" + id).dispatchEvent(new Event("change", {bubbles: true})));
        $$("#earnings-list .dynamic-item, #deductions-list .dynamic-item").forEach(element => element.remove());
        $$(".hours-echo").forEach(element => {
            element.textContent = "";
        });
        dsrManuallyEdited = false;
        autofillDsr();
        saveFormState();   // preserva o que foi digitado nas abas 13º e férias
        renderResult();
    });

    // Navegação por abas (as views vêm dos data-view dos botões).
    const viewIds = $$(".tabs button").map(button => button.dataset.view);
    $$(".tabs button").forEach(button => button.addEventListener("click", () => {
        $$(".tabs button").forEach(other => other.setAttribute("aria-selected", other === button ? "true" : "false"));
        viewIds.forEach(id => {
            $("#" + id).hidden = id !== button.dataset.view;
        });
        // A barra fixa do líquido (mobile) pertence só à calculadora mensal.
        $(".net-bar").classList.toggle("hidden", button.dataset.view !== "calculator-view");
    }));

    // Aba de parâmetros: trava por senha mestre.
    const tryUnlock = () => {
        const field = $("#master-password");
        if (!isMasterPassword(field.value)) {
            const error = $("#lock-error");
            error.classList.remove("hidden");
            setTimeout(() => error.classList.add("hidden"), 4000);
            field.select();
            return;
        }
        settingsUnlocked = true;
        field.value = "";
        applySettingsLock();
        const ok = $("#lock-ok");
        ok.classList.remove("hidden");
        setTimeout(() => ok.classList.add("hidden"), 2500);
    };

    $("#unlock-settings").addEventListener("click", tryUnlock);
    $("#master-password").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            tryUnlock();
        }
    });
    $("#lock-settings").addEventListener("click", () => {
        settingsUnlocked = false;
        renderSettings();
    });

    $("#add-inss-bracket").addEventListener("click", () => {
        activeParams.inss.brackets.push({upTo: activeParams.inss.ceiling, rate: 14});
        renderSettings();
    });
    $("#add-irrf-bracket").addEventListener("click", () => {
        activeParams.irrf.brackets.push({upTo: null, rate: 27.5, deduction: 0});
        renderSettings();
    });

    $("#settings-view").addEventListener("click", (event) => {
        const removeInss = event.target.getAttribute && event.target.getAttribute("data-remove-inss");
        const removeIrrf = event.target.getAttribute && event.target.getAttribute("data-remove-irrf");
        if (removeInss != null) {
            activeParams.inss.brackets.splice(Number(removeInss), 1);
            renderSettings();
        }
        if (removeIrrf != null) {
            activeParams.irrf.brackets.splice(Number(removeIrrf), 1);
            renderSettings();
        }
    });

    $("#save-settings").addEventListener("click", () => {
        if (!settingsUnlocked) return;
        if (!readSettings()) return;
        try {
            localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(activeParams));
        } catch (_) { /* segue */
        }
        renderSettings();
        updateBadges();
        renderResult();
        renderPj();
        const note = $("#settings-saved-note");
        note.classList.remove("hidden");
        setTimeout(() => note.classList.add("hidden"), 2500);
    });

    $("#reset-settings").addEventListener("click", () => {
        if (!settingsUnlocked) return;
        if (!confirm("Restaurar todos os parâmetros para os padrões de 2026?")) return;
        try {
            localStorage.removeItem(PARAMS_STORAGE_KEY);
        } catch (_) { /* segue */
        }
        activeParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
        renderSettings();
        updateBadges();
        renderResult();
        renderPj();
    });

    $("#export-settings").addEventListener("click", () => {
        readSettings();
        $("#settings-json").value = JSON.stringify(activeParams, null, 2);
    });

    $("#import-settings").addEventListener("click", () => {
        if (!settingsUnlocked) return;
        try {
            const imported = JSON.parse($("#settings-json").value);
            if (!imported.inss || !imported.irrf) throw new Error("estrutura inválida");
            activeParams = normalizeParams(imported);
            try {
                localStorage.setItem(PARAMS_STORAGE_KEY, JSON.stringify(activeParams));
            } catch (_) { /* segue */
            }
            renderSettings();
            updateBadges();
            renderResult();
            renderPj();
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
    renderThirteenth();
    renderVacation();
    renderSeverance();
    renderPj();
}

if (typeof document !== "undefined" && document.getElementById("payroll-form")) init();

/* Exporta o motor puro para testes em Node (não afeta o navegador). */
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        computePayroll, computeInss, computeIrrf, computeThirteenth, computeVacation,
        computeSeverance, computeNoticeDays, computeUnemployment,
        computePj, computeCltPackage, computeEquivalence, simplesEffectiveRate,
        taxFromTable, parseCurrency, parseHours, monthCalendar,
        parseIsoDate, calendarTwelfths, anniversaryTwelfths, DEFAULT_PARAMS
    };
}
