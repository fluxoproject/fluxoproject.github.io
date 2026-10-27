/* Modo "Entrar sem conta" do Fluxo.
   Funciona como um servidor de mentira dentro do navegador: o app faz as mesmas chamadas de sempre
   (api("/transactions") etc.) e, quando o modo visitante está ligado, quem responde é este arquivo.
   - Nada é enviado para o servidor e nenhuma conta é criada.
   - Os dados ficam só neste aparelho/navegador (localStorage) e começam com exemplos.
   - Conectar banco real (Open Finance) exige conta: nesse caso o app avisa. */
(function () {
  var FLAG = "fh_guest", STORE = "fh_guest_data";

  function active() { return localStorage.getItem(FLAG) === "1"; }
  function fail(status, msg) { var e = new Error(msg); e.status = status; return e; }

  /* ---------- dados de exemplo (datas sempre relativas a hoje) ---------- */
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function ago(days) { var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - days); return iso(d); }

  function seed() {
    var tx = [], id = 1;
    var CC = "guest-conta", CD = "guest-cartao";
    function add(date, desc, value, category, card) {
      tx.push({
        id: id++, date: date, desc: desc, bank_id: card ? CD : CC, value: value,
        type: value > 0 ? "entrada" : "saida", category: category,
        account_id: card ? CD : CC, account_name: card ? "Cartão Exemplo" : "Conta Corrente",
        account_type: card ? "CREDIT" : "BANK", category_manual: 0, external_id: "guest-" + id
      });
    }
    // 3 meses de movimento
    for (var m = 0; m < 3; m++) {
      var off = m * 30;
      add(ago(off + 2), "Salário Empresa Exemplo", 3200, "salario");
      add(ago(off + 4), "Aluguel", -1100, "contas");
      add(ago(off + 6), "Conta de luz", -142.35, "contas");
      add(ago(off + 7), "Internet fibra", -99.9, "contas");
      add(ago(off + 3), "Supermercado Bom Preço", -286.4, "alimentacao");
      add(ago(off + 9), "Supermercado Bom Preço", -241.17, "alimentacao");
      add(ago(off + 16), "Supermercado Bom Preço", -198.8, "alimentacao");
      add(ago(off + 5), "Posto Shell", -180, "transporte");
      add(ago(off + 12), "Uber", -23.9, "transporte");
      add(ago(off + 14), "Farmácia Saúde", -64.5, "saude");
      add(ago(off + 18), "Transferência recebida", 150, "transferencias");
      add(ago(off + 8), "iFood", -52.9, "alimentacao", true);
      add(ago(off + 11), "Netflix", -39.9, "entretenimento", true);
      add(ago(off + 13), "Spotify", -21.9, "entretenimento", true);
      add(ago(off + 15), "Loja de Roupas Centro", -189.9, "compras", true);
      add(ago(off + 20), "Restaurante Sabor Caseiro", -78, "alimentacao", true);
    }
    tx.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id; });

    var invHistory = [];
    for (var i = 60; i >= 0; i--) invHistory.push({ item_id: "guest-demo", inv_id: "guest-cdb", day: ago(i), balance: Math.round((5000 + (60 - i) * 3.85) * 100) / 100 });

    return {
      v: 1, nextId: 1000,
      transactions: tx,
      items: [{ id: 1, cpf: "", item_id: "guest-demo", institution_name: "Banco Exemplo", status: "UPDATED", last_sync: new Date().toISOString(), created_at: new Date().toISOString() }],
      accounts: [
        { account_id: CC, item_id: "guest-demo", name: "CONTA CORRENTE", type: "BANK", balance: 2350.78, updated_at: new Date().toISOString(), data: { subtype: "CHECKING_ACCOUNT", number: "0001" }, bills: [] },
        { account_id: CD, item_id: "guest-demo", name: "CARTÃO EXEMPLO", type: "CREDIT", balance: 641.1, updated_at: new Date().toISOString(),
          data: { subtype: "CREDIT_CARD", creditData: { creditLimit: 3000, availableCreditLimit: 2358.9 } }, bills: [] }
      ],
      investments: [{ inv_id: "guest-cdb", item_id: "guest-demo", name: "CDB Exemplo 100% CDI", type: "FIXED_INCOME", subtype: "CDB", balance: 5231.85, amount_original: 5000, profit: 231.85, applied_date: ago(60), due_date: null, updated_at: new Date().toISOString() }],
      invHistory: invHistory,
      custom: [], overrides: {}, planned: [], goals: [], subtitles: [], blocked: [],
      prefs: { theme: "light", currency: "BRL", ui: null }
    };
  }

  var db = null;
  function load() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(STORE) || "null"); } catch (e) { db = null; }
    if (!db || db.v !== 1) { db = seed(); save(); }
    return db;
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(db)); } catch (e) { /* sem espaço: segue na memória */ } }
  function nid() { var d = load(); return d.nextId++; }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  // mesma ideia do servidor: nome sem acento, minúsculo e sem número de parcela
  function nameKey(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/\b\d+\s*\/\s*\d+\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  }

  /* ---------- as "rotas" ---------- */
  function route(path, method, body) {
    var d = load(), u = path.split("?")[0], q = path.indexOf("?") >= 0 ? path.split("?")[1] : "", m, tx;
    body = body || {};

    if (u === "/me") return { user: { id: 0, name: "Visitante", email: "", avatar: null, guest: true }, preferences: { theme: d.prefs.theme, currency: d.prefs.currency, ui: d.prefs.ui } };
    if (u === "/me/preferences") { d.prefs.theme = body.theme || "light"; d.prefs.currency = body.currency || "BRL"; save(); return { ok: true }; }
    if (u === "/me/ui") { d.prefs.ui = typeof body.ui === "string" ? body.ui : null; save(); return { ok: true }; }
    if (u === "/me/visit") return { previous: null };
    if (u === "/sync-state") return { sig: "guest" };
    if (u === "/me/data" && method === "DELETE") {
      var keep = { prefs: d.prefs, items: d.items, accounts: d.accounts };
      db = seed(); db.prefs = keep.prefs; db.transactions = []; db.investments = []; db.invHistory = []; db.accounts = keep.accounts; db.items = keep.items; save();
      return { ok: true };
    }

    if (u === "/transactions" && method === "GET") return clone(d.transactions);
    if ((m = u.match(/^\/transactions\/(\d+)\/category$/))) {
      tx = d.transactions.find(function (t) { return t.id === +m[1]; });
      if (!tx) throw fail(404, "Transação não encontrada");
      tx.category = body.category; tx.category_manual = 1;
      var applied = 0, key = nameKey(tx.desc);
      if (key && body.category !== "nao_identificada") {
        d.transactions.forEach(function (t) { if (t.id !== tx.id && !t.category_manual && nameKey(t.desc) === key && t.category !== body.category) { t.category = body.category; applied++; } });
      }
      save(); return { ok: true, applied: applied };
    }
    if ((m = u.match(/^\/transactions\/(\d+)\/similar$/))) {
      tx = d.transactions.find(function (t) { return t.id === +m[1]; });
      if (!tx) throw fail(404, "Transação não encontrada");
      var k = nameKey(tx.desc);
      return { count: d.transactions.filter(function (t) { return t.id !== tx.id && nameKey(t.desc) === k; }).length, name: tx.desc };
    }
    if ((m = u.match(/^\/transactions\/(\d+)$/)) && method === "DELETE") {
      tx = d.transactions.find(function (t) { return t.id === +m[1]; });
      if (!tx) throw fail(404, "Transação não encontrada");
      var kk = nameKey(tx.desc), ids = [tx.id], blocked = false;
      if (q.indexOf("similar=1") >= 0 && kk) {
        d.transactions.forEach(function (t) { if (t.id !== tx.id && nameKey(t.desc) === kk) ids.push(t.id); });
        if (!d.blocked.some(function (b) { return b.key === kk; })) d.blocked.push({ id: nid(), key: kk, label: tx.desc });
        blocked = true;
      }
      d.transactions = d.transactions.filter(function (t) { return ids.indexOf(t.id) < 0; });
      save(); return { ok: true, deleted: ids.length, blocked: blocked, name: tx.desc };
    }
    if (u === "/blocked-names") return d.blocked.map(function (b) { return { id: b.id, label: b.label }; });
    if ((m = u.match(/^\/blocked-names\/(\d+)$/))) {
      var n0 = d.blocked.length; d.blocked = d.blocked.filter(function (b) { return b.id !== +m[1]; });
      if (d.blocked.length === n0) throw fail(404, "Nome não encontrado");
      save(); return { ok: true };
    }

    // categorias
    if (u === "/categories" && method === "GET") return { custom: clone(d.custom), overrides: clone(d.overrides) };
    if (u === "/categories" && method === "POST") {
      var nm = (body.name || "").trim(), ic = (body.icon || "").trim();
      if (!nm || !ic) throw fail(400, "Nome e emoji são obrigatórios.");
      var colors = ["#F59E0B", "#3B82F6", "#6366F1", "#A855F7", "#EC4899", "#EF4444", "#14B8A6", "#0EA5E9", "#10B981", "#B45309"];
      var c = { id: "custom_" + nid(), name: nm, icon: ic, color: colors[d.custom.length % colors.length] };
      d.custom.push(c); save(); return clone(c);
    }
    if ((m = u.match(/^\/categories\/(.+)$/))) {
      var cid = decodeURIComponent(m[1]);
      if (method === "PUT") {
        var n1 = (body.name || "").trim(), i1 = (body.icon || "").trim();
        if (!n1 || !i1) throw fail(400, "Nome e emoji são obrigatórios.");
        if (cid.indexOf("custom_") === 0) { d.custom.forEach(function (x) { if (x.id === cid) { x.name = n1; x.icon = i1; } }); }
        else { var o = d.overrides[cid] || {}; d.overrides[cid] = { name: n1, icon: i1, color: (body.color || "").trim() || o.color || null, deleted: false }; }
        save(); return { ok: true };
      }
      if (method === "DELETE") {
        if (cid === "outros" || cid === "nao_identificada") throw fail(400, "Essa categoria não pode ser excluída.");
        d.transactions.forEach(function (t) { if (t.category === cid) t.category = "outros"; });
        if (cid.indexOf("custom_") === 0) d.custom = d.custom.filter(function (x) { return x.id !== cid; });
        else d.overrides[cid] = Object.assign({}, d.overrides[cid], { deleted: true });
        save(); return { ok: true };
      }
    }

    // planejamento
    if (u === "/planned" && method === "GET") return clone(d.planned);
    if (u === "/planned" && method === "DELETE") { var cnt = d.planned.length; d.planned = []; save(); return { ok: true, deleted: cnt }; }
    if (u === "/planned" && method === "POST") {
      var v = Number(body.value);
      if (!body.name || !String(body.name).trim()) throw fail(400, "Dê um nome para o planejado.");
      if (!v || v <= 0) throw fail(400, "Valor inválido.");
      if (["entrada", "saida"].indexOf(body.type) < 0) throw fail(400, "Tipo inválido.");
      if (!/^\d{4}-\d{2}$/.test(body.month || "")) throw fail(400, "Mês inválido.");
      var it = { id: nid(), name: String(body.name).trim(), value: v, type: body.type, month: body.month, paid: 0, tx_id: null, category: body.category || null, subtitle: body.subtitle || null, day: body.day === "" || body.day == null ? null : Number(body.day), created_at: new Date().toISOString() };
      d.planned.push(it); save(); return clone(it);
    }
    if ((m = u.match(/^\/planned\/(\d+)(\/(pay|unpay))?$/))) {
      var p = d.planned.find(function (x) { return x.id === +m[1]; });
      if (!p) throw fail(404, "Não encontrado");
      if (m[3] === "pay") { if (p.paid) throw fail(400, "Já está marcado como pago."); p.paid = 1; save(); return clone(p); }
      if (m[3] === "unpay") { p.paid = 0; save(); return clone(p); }
      if (method === "DELETE") { d.planned = d.planned.filter(function (x) { return x.id !== p.id; }); save(); return { ok: true }; }
      if (method === "PUT") {
        var v2 = Number(body.value);
        if (!body.name || !String(body.name).trim() || !v2 || v2 <= 0 || ["entrada", "saida"].indexOf(body.type) < 0 || !/^\d{4}-\d{2}$/.test(body.month || "")) throw fail(400, "Dados inválidos.");
        Object.assign(p, { name: String(body.name).trim(), value: v2, type: body.type, month: body.month, category: body.category || null, subtitle: body.subtitle || null, day: body.day === "" || body.day == null ? null : Number(body.day) });
        save(); return clone(p);
      }
    }

    // metas por categoria
    if (u === "/goals" && method === "GET") return clone(d.goals);
    if (u === "/goals" && method === "POST") {
      var gv = Number(body.value), gm = body.month && /^\d{4}-\d{2}$/.test(body.month) ? body.month : null;
      if (!body.category || !gv || gv <= 0) throw fail(400, "Dados inválidos.");
      var g = d.goals.find(function (x) { return x.category === body.category && (x.month || null) === gm; });
      if (g) g.value = gv; else { g = { id: nid(), category: body.category, month: gm, value: gv, created_at: new Date().toISOString() }; d.goals.push(g); }
      save(); return clone(g);
    }
    if ((m = u.match(/^\/goals\/(\d+)$/)) && method === "DELETE") {
      var n2 = d.goals.length; d.goals = d.goals.filter(function (x) { return x.id !== +m[1]; });
      if (d.goals.length === n2) throw fail(404, "Não encontrado");
      save(); return { ok: true };
    }
    if (u === "/subtitles" && method === "GET") return clone(d.subtitles);
    if (u === "/subtitles" && method === "POST") {
      var sn = (body.name || "").trim();
      if (!body.category || !sn) throw fail(400, "Dê um nome para o subtítulo.");
      var s = d.subtitles.find(function (x) { return x.category === body.category && x.name === sn; });
      if (!s) { s = { id: nid(), category: body.category, name: sn, created_at: new Date().toISOString() }; d.subtitles.push(s); save(); }
      return clone(s);
    }
    if ((m = u.match(/^\/subtitles\/(\d+)$/)) && method === "DELETE") {
      var sub = d.subtitles.find(function (x) { return x.id === +m[1]; });
      if (!sub) throw fail(404, "Não encontrado");
      d.planned.forEach(function (p2) { if (p2.category === sub.category && p2.subtitle === sub.name) p2.subtitle = null; });
      d.subtitles = d.subtitles.filter(function (x) { return x.id !== sub.id; });
      save(); return { ok: true };
    }

    // bancos e investimentos (nesta versão são só de exemplo)
    if (u === "/pluggy/items" && method === "GET") return clone(d.items);
    if (u === "/pluggy/accounts" && method === "GET") return clone(d.accounts);
    if (u.indexOf("/pluggy/sync/") === 0) return { novas: 0, contasEncontradas: d.accounts.length, transacoesProcessadas: d.transactions.length, erros: [], item: { status: "UPDATED" } };
    if ((m = u.match(/^\/pluggy\/accounts\/(.+)$/)) && method === "DELETE") {
      var aid = decodeURIComponent(m[1]);
      d.accounts = d.accounts.filter(function (a) { return a.account_id !== aid; });
      d.transactions = d.transactions.filter(function (t) { return t.account_id !== aid; });
      save(); return { ok: true };
    }
    if ((m = u.match(/^\/pluggy\/items\/(.+)$/)) && method === "DELETE") {
      d.items = []; d.accounts = []; d.transactions = []; d.investments = []; d.invHistory = []; save(); return { ok: true };
    }
    if (u.indexOf("/pluggy/") === 0) throw fail(403, "Para conectar um banco de verdade, crie uma conta. No modo sem conta o app usa só dados de exemplo.");
    if (u === "/investments" && method === "GET") return { investments: clone(d.investments), history: clone(d.invHistory) };
    if ((m = u.match(/^\/investments\/(.+)\/date$/)) && method === "PUT") {
      var iid = decodeURIComponent(m[1]);
      d.investments.forEach(function (x) { if (x.inv_id === iid) x.applied_date = body.date; });
      save(); return { ok: true };
    }

    throw fail(404, "Não disponível no modo sem conta.");
  }

  window.FluxoGuest = {
    active: active,
    enter: function () { localStorage.setItem(FLAG, "1"); load(); },
    exit: function () { localStorage.removeItem(FLAG); },
    // apaga tudo do modo visitante deste aparelho
    wipe: function () { localStorage.removeItem(STORE); db = null; },
    call: function (path, method, body) {
      return new Promise(function (resolve, reject) {
        try { resolve(route(path, method || "GET", body)); } catch (e) { reject(e); }
      });
    }
  };
})();
