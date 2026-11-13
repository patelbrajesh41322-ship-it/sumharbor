(function () {
  'use strict';

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  function val(f, n) { return parseFloat(f.elements[n].value); }
  function dur(months) {
    var y = Math.floor(months / 12), m = months % 12, s = [];
    if (y) s.push(y + (y === 1 ? ' year' : ' years'));
    if (m || !y) s.push(m + (m === 1 ? ' month' : ' months'));
    return s.join(' ');
  }
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  var SCALE = { 'A+': 4.0, 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0 };

  function payoff(bal, apr, pay) {
    var i = apr / 1200, months = 0, interest = 0;
    while (bal > 0.005 && months < 1200) {
      var m = bal * i;
      if (pay <= m) { return null; }
      interest += m; bal += m;
      if (bal <= pay) { months++; bal = 0; break; }
      bal -= pay; months++;
    }
    if (bal > 0.005) { return null; }
    return { months: months, interest: interest };
  }

  function emiOf(P, r, n) {
    var i = r / 1200;
    if (i === 0) return P / n;
    var g = Math.pow(1 + i, n);
    return P * i * g / (g - 1);
  }

  var calcs = {
    gpa: function (f) {
      var rows = f.querySelectorAll('.course'), pts = 0, cr = 0, used = 0, i;
      for (i = 0; i < rows.length; i++) {
        var g = rows[i].querySelector('.g').value;
        var c = parseFloat(rows[i].querySelector('.cr').value);
        if (g === '' || !(c > 0)) { continue; }
        pts += SCALE[g] * c; cr += c; used++;
      }
      if (cr === 0) { return { error: 'Add at least one course with a grade and credits.' }; }
      var out = [
        ['Courses counted', String(used)],
        ['Credits this term', fmt(cr)],
        ['Quality points', fmt(pts)]
      ];
      var cg = f.elements.cgpa.value, cc = f.elements.ccredits.value;
      if (cg !== '' && cc !== '') {
        cg = parseFloat(cg); cc = parseFloat(cc);
        if (!(cg >= 0 && cg <= 4.3) || !(cc > 0)) {
          return { error: 'Enter your current GPA on a 4.0 scale and the credits you have completed.' };
        }
        out.push(['New cumulative GPA', ((cg * cc + pts) / (cc + cr)).toFixed(2)]);
        out.push(['Total credits', fmt(cc + cr)]);
      }
      return { head: ['Term GPA', (pts / cr).toFixed(2)], rows: out };
    },

    finalgrade: function (f) {
      var c = val(f, 'current'), w = val(f, 'weight'), t = val(f, 'target');
      if (!(c >= 0 && c <= 200)) return { error: 'Enter your current grade as a percentage.' };
      if (!(w > 0 && w <= 100)) return { error: 'The final exam weight must be between 0 and 100 percent.' };
      if (!(t >= 0 && t <= 200)) return { error: 'Enter the grade you want as a percentage.' };
      var wd = w / 100;
      function need(target) { return (target - c * (1 - wd)) / wd; }
      var n = need(t), note;
      if (n <= 0) { note = 'You already have this grade, even with a 0% on the final.'; }
      else if (n > 100) { note = 'This is above 100%. It may not be possible without extra credit.'; }
      else { note = 'Score at least this on the final to reach your target.'; }
      var targets = [90, 80, 70, 60], rows = [];
      targets.forEach(function (x) {
        var r = need(x);
        rows.push([x + '%', r <= 0 ? 'Already secured' : r.toFixed(1) + '%']);
      });
      return {
        head: ['Score needed on the final', Math.max(n, 0).toFixed(1) + '%'],
        rows: [['Current grade', c + '%'], ['Final exam weight', w + '%'], ['Target grade', t + '%'], ['What it means', note]],
        table: { title: 'Score needed for other targets', cols: ['Target', 'Needed on final'], rows: rows }
      };
    },

    carloan: function (f) {
      var B = val(f, 'balance'), r = val(f, 'apr'), P = val(f, 'payment'), X = val(f, 'extra');
      if (isNaN(X)) { X = 0; }
      if (!(B > 0)) return { error: 'Enter your remaining loan balance.' };
      if (!(r >= 0 && r <= 100)) return { error: 'Enter the APR as a percentage between 0 and 100.' };
      if (!(P > 0)) return { error: 'Enter your regular monthly payment.' };
      if (!(X >= 0)) return { error: 'Extra payment cannot be negative.' };
      var base = payoff(B, r, P);
      if (!base) return { error: 'Your monthly payment is too low to cover the monthly interest. Increase the payment.' };
      var fast = X > 0 ? payoff(B, r, P + X) : base;
      var rows = [
        ['Remaining balance', usd.format(B)],
        ['Time left (no extra)', dur(base.months)],
        ['Interest (no extra)', usd.format(base.interest)]
      ];
      if (X > 0) {
        rows.push(['Time left (with extra)', dur(fast.months)]);
        rows.push(['Interest (with extra)', usd.format(fast.interest)]);
        rows.push(['Interest saved', usd.format(base.interest - fast.interest)]);
        rows.push(['Time saved', dur(base.months - fast.months)]);
      }
      return { head: [X > 0 ? 'Paid off in (with extra)' : 'Paid off in', dur(fast.months)], rows: rows };
    },

    margin: function (f) {
      var mode = f.elements.mode.value, cost = val(f, 'cost'), v = val(f, 'value'), price;
      if (!(cost > 0)) return { error: 'Enter your cost.' };
      if (mode === 'price') {
        if (!(v > 0)) return { error: 'Enter the selling price.' };
        price = v;
      } else if (mode === 'margin') {
        if (!(v >= 0 && v < 100)) return { error: 'Margin must be between 0% and 99.99%.' };
        price = cost / (1 - v / 100);
      } else {
        if (!(v >= 0)) return { error: 'Markup cannot be negative.' };
        price = cost * (1 + v / 100);
      }
      var profit = price - cost;
      return {
        head: ['Selling price', usd.format(price)],
        rows: [
          ['Cost', usd.format(cost)],
          ['Profit', usd.format(profit)],
          ['Gross margin', (profit / price * 100).toFixed(2) + '%'],
          ['Markup', (profit / cost * 100).toFixed(2) + '%']
        ]
      };
    }
    ,
    weighted: function (f) {
      var rows = f.querySelectorAll('.course'), pts = 0, wt = 0, used = 0, i;
      for (i = 0; i < rows.length; i++) {
        var sc = parseFloat(rows[i].querySelector('.sc').value);
        var w = parseFloat(rows[i].querySelector('.wt').value);
        if (isNaN(sc) || !(w > 0)) { continue; }
        if (!(sc >= 0 && sc <= 200)) { return { error: 'Enter each score as a percentage, like 85.' }; }
        pts += sc * w; wt += w; used++;
      }
      if (wt === 0) { return { error: 'Add at least one score with a weight.' }; }
      if (wt > 100.0001) { return { error: 'Your weights add up to ' + fmt(wt) + '%. They should add up to 100% or less.' }; }
      return {
        head: ['Your weighted grade', (pts / wt).toFixed(2) + '%'],
        rows: [
          ['Items counted', String(used)],
          ['Weight counted', fmt(wt) + '%'],
          ['Weight remaining', fmt(100 - wt) + '%'],
          ['Points earned', fmt(pts / 100) + ' of ' + fmt(wt)]
        ]
      };
    },

    carpayment: function (f) {
      var price = val(f, 'price'), down = val(f, 'down'), trade = val(f, 'trade');
      var apr = val(f, 'apr'), n = Math.round(val(f, 'term'));
      if (isNaN(down)) { down = 0; }
      if (isNaN(trade)) { trade = 0; }
      if (!(price > 0)) return { error: 'Enter the vehicle price.' };
      if (down < 0 || trade < 0) return { error: 'Down payment and trade-in cannot be negative.' };
      var loan = price - down - trade;
      if (!(loan > 0)) return { error: 'Your down payment and trade-in cover the full price, so there is nothing to finance.' };
      if (!(apr >= 0 && apr <= 100)) return { error: 'Enter the APR as a percentage between 0 and 100.' };
      if (!(n >= 1 && n <= 120)) return { error: 'Loan term must be between 1 and 120 months.' };
      var pay = emiOf(loan, apr, n), total = pay * n;
      return {
        head: ['Estimated monthly payment', usd.format(pay)],
        rows: [
          ['Amount financed', usd.format(loan)],
          ['Loan term', n + ' months'],
          ['Total interest', usd.format(total - loan)],
          ['Total of all payments', usd.format(total)]
        ]
      };
    },

    breakeven: function (f) {
      var fixed = val(f, 'fixed'), price = val(f, 'price'), vc = val(f, 'variable'), goal = val(f, 'goal');
      if (isNaN(goal)) { goal = 0; }
      if (!(fixed >= 0)) return { error: 'Enter your fixed costs (use 0 if none).' };
      if (!(price > 0)) return { error: 'Enter the selling price per unit.' };
      if (!(vc >= 0)) return { error: 'Enter the variable cost per unit (use 0 if none).' };
      if (!(goal >= 0)) return { error: 'Target profit cannot be negative.' };
      var cm = price - vc;
      if (!(cm > 0)) return { error: 'Your price must be higher than your variable cost per unit.' };
      var units = Math.ceil(fixed / cm - 1e-9), rows = [
        ['Profit per unit', usd.format(cm)],
        ['Contribution margin', (cm / price * 100).toFixed(1) + '%'],
        ['Break-even revenue', usd.format(units * price)]
      ];
      if (goal > 0) {
        var gu = Math.ceil((fixed + goal) / cm - 1e-9);
        rows.push(['Units for your profit goal', gu.toLocaleString('en-US')]);
        rows.push(['Revenue for your profit goal', usd.format(gu * price)]);
      }
      return { head: ['Break-even point', units.toLocaleString('en-US') + (units === 1 ? ' unit' : ' units')], rows: rows };
    },

    salary: function (f) {
      var mode = f.elements.mode.value, v = val(f, 'value'), hrs = val(f, 'hours'), wks = val(f, 'weeks');
      if (!(v > 0)) return { error: mode === 'hourly' ? 'Enter your hourly pay.' : 'Enter your annual salary.' };
      if (!(hrs > 0 && hrs <= 168)) return { error: 'Hours per week must be between 1 and 168.' };
      if (!(wks > 0 && wks <= 52)) return { error: 'Weeks per year must be between 1 and 52.' };
      var hourly, annual;
      if (mode === 'hourly') { hourly = v; annual = v * hrs * wks; }
      else { annual = v; hourly = v / (hrs * wks); }
      var weekly = hourly * hrs;
      return {
        head: [mode === 'hourly' ? 'Annual pay (before taxes)' : 'Hourly pay (before taxes)', mode === 'hourly' ? usd.format(annual) : usd.format(hourly)],
        rows: [
          ['Hourly', usd.format(hourly)],
          ['Weekly', usd.format(weekly)],
          ['Every 2 weeks', usd.format(weekly * 2)],
          ['Twice a month', usd.format(annual / 24)],
          ['Monthly', usd.format(annual / 12)],
          ['Annual', usd.format(annual)]
        ]
      };
    }
    ,
    wgpa: function (f) {
      var rows = f.querySelectorAll('.course'), up = 0, wp = 0, cr = 0, used = 0, i;
      var BONUS = { regular: 0, honors: 0.5, ap: 1.0 };
      for (i = 0; i < rows.length; i++) {
        var g = rows[i].querySelector('.g').value;
        var c = parseFloat(rows[i].querySelector('.cr').value);
        var lv = rows[i].querySelector('.lv').value;
        if (g === '' || !(c > 0)) { continue; }
        var base = SCALE[g];
        up += base * c;
        wp += (base + (base > 0 ? BONUS[lv] : 0)) * c;
        cr += c; used++;
      }
      if (cr === 0) { return { error: 'Add at least one course with a grade and credits.' }; }
      return {
        head: ['Weighted GPA', (wp / cr).toFixed(2)],
        rows: [
          ['Unweighted GPA', (up / cr).toFixed(2)],
          ['Courses counted', String(used)],
          ['Credits', fmt(cr)]
        ]
      };
    },

    gradepercent: function (f) {
      var e = val(f, 'earned'), p = val(f, 'possible');
      if (!(e >= 0)) return { error: 'Enter the points you earned.' };
      if (!(p > 0)) return { error: 'Enter the total points possible.' };
      var pct = e / p * 100, letter;
      if (pct >= 97) letter = 'A+'; else if (pct >= 93) letter = 'A'; else if (pct >= 90) letter = 'A-';
      else if (pct >= 87) letter = 'B+'; else if (pct >= 83) letter = 'B'; else if (pct >= 80) letter = 'B-';
      else if (pct >= 77) letter = 'C+'; else if (pct >= 73) letter = 'C'; else if (pct >= 70) letter = 'C-';
      else if (pct >= 67) letter = 'D+'; else if (pct >= 63) letter = 'D'; else if (pct >= 60) letter = 'D-';
      else letter = 'F';
      return {
        head: ['Your grade', pct.toFixed(2) + '% (' + letter + ')'],
        rows: [
          ['Points earned', fmt(e)],
          ['Points possible', fmt(p)],
          ['Points missed', fmt(Math.max(p - e, 0))]
        ]
      };
    },

    discount: function (f) {
      var P = val(f, 'price'), d = val(f, 'off'), t = val(f, 'tax');
      if (isNaN(t)) { t = 0; }
      if (!(P > 0)) return { error: 'Enter the original price.' };
      if (!(d >= 0 && d <= 100)) return { error: 'Enter a discount between 0% and 100%.' };
      if (!(t >= 0 && t <= 100)) return { error: 'Enter a sales tax rate between 0% and 100%, or leave it at 0.' };
      var sale = P * (1 - d / 100), tax = sale * t / 100;
      return {
        head: ['Sale price', usd.format(sale)],
        rows: [
          ['Original price', usd.format(P)],
          ['You save', usd.format(P - sale)],
          ['Sales tax (' + t + '%)', usd.format(tax)],
          ['Total to pay', usd.format(sale + tax)]
        ]
      };
    },

    tip: function (f) {
      var bill = val(f, 'bill'), pct = val(f, 'tip'), n = Math.round(val(f, 'people'));
      if (!(bill > 0)) return { error: 'Enter the bill amount.' };
      if (!(pct >= 0 && pct <= 100)) return { error: 'Enter a tip between 0% and 100%.' };
      if (!(n >= 1 && n <= 100)) return { error: 'Enter how many people are splitting the bill (1 to 100).' };
      var tip = bill * pct / 100, total = bill + tip;
      return {
        head: [n > 1 ? 'Each person pays' : 'Total to pay', usd.format(total / n)],
        rows: [
          ['Bill', usd.format(bill)],
          ['Tip (' + pct + '%)', usd.format(tip)],
          ['Total', usd.format(total)],
          ['Tip per person', usd.format(tip / n)]
        ]
      };
    }

  };

  if (typeof module !== 'undefined') { module.exports = calcs; }
  if (typeof document === 'undefined') { return; }

  var form = document.querySelector('form[data-calc]');
  var out = document.getElementById('result');
  if (!form || !out) { return; }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function renderTable(t) {
    var wrap = el('div', 'tablewrap');
    wrap.appendChild(el('p', 'table-title', t.title));
    var scroll = el('div', 'tablescroll'), table = el('table'), thead = el('thead'), hr = el('tr');
    t.cols.forEach(function (c) { hr.appendChild(el('th', '', c)); });
    thead.appendChild(hr); table.appendChild(thead);
    var tbody = el('tbody');
    t.rows.forEach(function (row) {
      var tr = el('tr');
      row.forEach(function (cell) { tr.appendChild(el('td', '', cell)); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); scroll.appendChild(table); wrap.appendChild(scroll);
    return wrap;
  }

  function render(r) {
    out.hidden = false;
    out.textContent = '';
    if (r.error) { out.appendChild(el('p', 'err', r.error)); return; }
    var head = el('div', 'head');
    head.appendChild(el('span', 'head-label', r.head[0]));
    head.appendChild(el('strong', 'head-value', r.head[1]));
    out.appendChild(head);
    var ul = el('ul', 'ledger');
    r.rows.forEach(function (row) {
      var li = el('li');
      li.appendChild(el('span', 'k', row[0]));
      li.appendChild(el('span', 'dots'));
      li.appendChild(el('span', 'v', row[1]));
      ul.appendChild(li);
    });
    out.appendChild(ul);
    if (r.table) { out.appendChild(renderTable(r.table)); }
    out.appendChild(el('p', 'note', 'Results are estimates for information only, not financial or academic advice.'));
  }

  function run() { render(calcs[form.getAttribute('data-calc')](form)); }

  /* Rows for the GPA, weighted GPA and weighted grade calculators */
  var list = document.getElementById('courses');
  if (list) {
    var kind = list.getAttribute('data-kind') || 'gpa';
    var grades = ['', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    var seeds = {
      gpa: [['', 'A', '3'], ['', 'A-', '3'], ['', 'B+', '4'], ['', 'B', '3'], ['', '', '3']],
      wgpa: [['', 'A', '3', 'regular'], ['', 'A-', '3', 'honors'], ['', 'B+', '4', 'ap'], ['', 'B', '3', 'regular'], ['', '', '3', 'regular']],
      weighted: [['Homework', '92', '20'], ['Quizzes', '85', '20'], ['Midterm exam', '78', '25'], ['', '', '']]
    };
    var gradeSelect = function (value) {
      var sel = el('select', 'g'); sel.setAttribute('aria-label', 'Grade');
      grades.forEach(function (g) { var o = el('option', '', g === '' ? 'Grade' : g); o.value = g; sel.appendChild(o); });
      sel.value = value; return sel;
    };
    var levelSelect = function (value) {
      var sel = el('select', 'lv'); sel.setAttribute('aria-label', 'Course level');
      [['regular', 'Regular'], ['honors', 'Honors'], ['ap', 'AP / IB']].forEach(function (p) {
        var o = el('option', '', p[1]); o.value = p[0]; sel.appendChild(o);
      });
      sel.value = value; return sel;
    };
    var numInput = function (cls, placeholder, label, value) {
      var c = el('input', cls); c.type = 'number'; c.min = '0'; c.step = 'any'; c.inputMode = 'decimal';
      c.placeholder = placeholder; c.setAttribute('aria-label', label); c.value = value; c.autocomplete = 'off';
      return c;
    };
    var makeRow = function (s) {
      var row = el('div', kind === 'wgpa' ? 'course w4' : 'course');
      var name = el('input', 'cname'); name.type = 'text';
      name.placeholder = kind === 'weighted' ? 'Assignment or category (optional)' : 'Course name (optional)';
      name.value = s[0]; name.setAttribute('aria-label', 'Name'); name.autocomplete = 'off';
      row.appendChild(name);
      if (kind === 'weighted') {
        row.appendChild(numInput('sc', 'Score (%)', 'Score percent', s[1]));
        row.appendChild(numInput('wt', 'Weight (%)', 'Weight percent', s[2]));
      } else {
        row.appendChild(gradeSelect(s[1]));
        row.appendChild(numInput('cr', 'Credits', 'Credits', s[2]));
        if (kind === 'wgpa') { row.appendChild(levelSelect(s[3])); }
      }
      var x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove row');
      x.addEventListener('click', function () { if (list.children.length > 1) { list.removeChild(row); } });
      row.appendChild(x);
      return row;
    };
    seeds[kind].forEach(function (s) { list.appendChild(makeRow(s)); });
    var add = document.getElementById('add-course');
    if (add) {
      add.addEventListener('click', function () {
        if (list.children.length < 25) {
          list.appendChild(makeRow(kind === 'weighted' ? ['', '', ''] : kind === 'wgpa' ? ['', '', '3', 'regular'] : ['', '', '3']));
        }
      });
    }
  }

  /* Dynamic label for the margin calculator */
  var sel = form.querySelector('select[data-labels]');
  if (sel) {
    var map = JSON.parse(sel.getAttribute('data-labels'));
    var tgt = document.getElementById(sel.getAttribute('data-target'));
    var upd = function () { tgt.textContent = map[sel.value] || ''; };
    sel.addEventListener('change', upd); upd();
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  run();
})();
