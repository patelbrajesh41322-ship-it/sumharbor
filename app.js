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
        ['Without extra: time left', dur(base.months)],
        ['Without extra: total interest', usd.format(base.interest)]
      ];
      if (X > 0) {
        rows.push(['With extra: time left', dur(fast.months)]);
        rows.push(['With extra: total interest', usd.format(fast.interest)]);
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

  /* GPA course rows */
  var list = document.getElementById('courses');
  if (list) {
    var grades = ['', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    var seed = [['', 'A', '3'], ['', 'A-', '3'], ['', 'B+', '4'], ['', 'B', '3'], ['', '', '3']];
    var makeRow = function (s) {
      var row = el('div', 'course');
      var name = el('input', 'cname'); name.type = 'text'; name.placeholder = 'Course name (optional)'; name.value = s[0];
      name.setAttribute('aria-label', 'Course name');
      var sel = el('select', 'g'); sel.setAttribute('aria-label', 'Grade');
      grades.forEach(function (g) { var o = el('option', '', g === '' ? 'Grade' : g); o.value = g; if (g === s[1]) { o.selected = true; } sel.appendChild(o); });
      var cr = el('input', 'cr'); cr.type = 'number'; cr.min = '0'; cr.step = 'any'; cr.inputMode = 'decimal'; cr.value = s[2];
      cr.setAttribute('aria-label', 'Credits');
      var x = el('button', 'x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove course');
      x.addEventListener('click', function () { if (list.children.length > 1) { list.removeChild(row); } });
      row.appendChild(name); row.appendChild(sel); row.appendChild(cr); row.appendChild(x);
      return row;
    };
    seed.forEach(function (s) { list.appendChild(makeRow(s)); });
    var add = document.getElementById('add-course');
    if (add) { add.addEventListener('click', function () { if (list.children.length < 20) { list.appendChild(makeRow(['', '', '3'])); } }); }
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
