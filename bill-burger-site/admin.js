import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DEFAULT = {
    whatsapp: "5522998425652",
    instagram: "https://www.instagram.com/billburgue/",
    address: "Rua das Marrecas, 52, Caju, Silva Jardim, RJ",
    maps: ""
  };
  const ready = /^https:\/\/[^/]+\.supabase\.co\/?$/.test(SUPABASE_URL)
    && typeof SUPABASE_ANON_KEY === "string"
    && SUPABASE_ANON_KEY.length > 25
    && !/COLE_AQUI|service_role|secret/i.test(SUPABASE_ANON_KEY);

  const grid = document.querySelector(".menu-grid");
  const categoryMeta = [...grid.querySelectorAll(".menu-card")].map(card => ({
    id: card.dataset.category,
    title: card.querySelector("h3")?.textContent.trim() || card.dataset.category
  }));

  // Converte o HTML inicial em dados sem perder preços por tamanho/sabor.
  const originalItems = [];
  grid.querySelectorAll(".menu-card").forEach(card => {
    card.querySelectorAll(".menu-item").forEach(row => {
      const priceList = row.querySelector(".price-list");
      let price = "";
      if (priceList) {
        const values = [...priceList.querySelectorAll("span")].map(s => s.textContent.trim());
        if (card.dataset.category === "burguer" && values.length === 3) {
          price = `Tradicional: R$ ${values[0]} | Frango: R$ ${values[1]} | Picanha: R$ ${values[2]}`;
        } else {
          price = values.join(" | ");
        }
      } else {
        price = row.querySelector(".price")?.textContent.trim() || "Consultar";
      }
      originalItems.push({
        category: card.dataset.category,
        name: row.querySelector(".item-name")?.textContent.trim() || "Item",
        description: row.querySelector(".item-desc")?.textContent.trim() || "",
        price: price.replace(/\s+/g, " ").trim(),
        sort_order: originalItems.length
      });
    });
  });

  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));

  let supabase = null;
  let session = null;
  let isAdmin = false;
  let items = originalItems.map((item, i) => ({ ...item, id: `local-${i}` }));
  let config = { ...DEFAULT };
  let reviews = [];
  let selectedRating = null;

  function setFeedback(id, message, isError = false) {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? "#ff9999" : "#bdbdbd";
  }

  function showConnectionError() {
    const notice = document.querySelector(".admin-notice");
    if (notice) notice.textContent =
      "Supabase ainda não está conectado. Confira supabase-config.js e execute supabase-schema.sql no SQL Editor. O cardápio original continua visível.";
    setFeedback("review-feedback", "Avaliações online indisponíveis enquanto o Supabase não estiver configurado.", true);
  }

  function waUrl() {
    const phone = String(config.whatsapp || "").replace(/\D/g, "");
    return phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent("Olá, Bill Burger! Vim pelo site e gostaria de fazer um pedido.")}`
      : "#";
  }

  function applyConfig() {
    document.querySelectorAll("[data-whatsapp]").forEach(a => a.href = waUrl());
    document.querySelectorAll("[data-instagram]").forEach(a => a.href = config.instagram || "#");
    $("store-address").textContent = config.address || DEFAULT.address;
    const map = document.querySelector("[data-maps]");
    if (map) map.href = config.maps ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address || DEFAULT.address)}`;
  }

  function renderPrice(price) {
    const parts = String(price || "Consultar").split("|").map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      return `<div class="price-list">${parts.map(part => `<span>${esc(part)}</span>`).join("")}</div>`;
    }
    return `<span class="price">${esc(parts[0] || "Consultar")}</span>`;
  }

  function renderMenu() {
    const cats = [...new Set([...categoryMeta.map(c => c.id), ...items.map(i => i.category)])];
    grid.innerHTML = cats.map(cat => {
      const title = categoryMeta.find(c => c.id === cat)?.title || cat;
      const rows = items.filter(i => i.category === cat).map(item =>
        `<div class="menu-item">
          <div class="item-info">
            <div class="item-name">${esc(item.name)}</div>
            ${item.description ? `<div class="item-desc">${esc(item.description)}</div>` : ""}
            ${renderPrice(item.price)}
          </div>
        </div>`
      ).join("");
      return `<article class="menu-card" data-category="${esc(cat)}"><h3>${esc(title)}</h3>${rows || '<p class="sub">Novidades em breve.</p>'}</article>`;
    }).join("");
    document.querySelectorAll(".tab").forEach(button => {
      button.onclick = () => {
        document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
        document.querySelectorAll(".menu-card").forEach(card => {
          card.hidden = button.dataset.filter !== "todos" && card.dataset.category !== button.dataset.filter;
        });
      };
    });
  }

  function renderReviews() {
    const count = reviews.length;
    const average = count ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / count : 0;
    $("rating-average").textContent = count ? average.toFixed(1).replace(".", ",") : "—";
    $("rating-stars").textContent = count
      ? "★".repeat(Math.round(average)) + "☆".repeat(5 - Math.round(average))
      : "☆☆☆☆☆";
    $("rating-count").textContent = count ? `${count} avaliação(ões)` : "Ainda sem avaliações";
    $("review-list").innerHTML = reviews.map(review =>
      `<article class="review-card">
        <strong>${esc(review.customer_name || "Cliente Bill Burger")}</strong>
        <div class="review-stars">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</div>
        ${review.message ? `<p>${esc(review.message)}</p>` : ""}
      </article>`
    ).join("");
  }

  function setRating(value) {
    selectedRating = value;
    document.querySelectorAll("[data-star]").forEach(button => {
      button.classList.toggle("selected", Number(button.dataset.star) <= value);
      button.setAttribute("aria-pressed", String(Number(button.dataset.star) === value));
    });
  }
  document.querySelectorAll("[data-star]").forEach(button =>
    button.addEventListener("click", () => setRating(Number(button.dataset.star)))
  );

  $("review-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!supabase) return setFeedback("review-feedback", "Sistema de avaliações indisponível: configure o Supabase.", true);
    if (!selectedRating || selectedRating < 1 || selectedRating > 5)
      return setFeedback("review-feedback", "Selecione uma nota de 1 a 5 estrelas.", true);

    setFeedback("review-feedback", "Enviando avaliação...");
    const { error } = await supabase.from("reviews").insert({
      customer_name: $("review-name").value.trim() || null,
      rating: selectedRating,
      message: $("review-message").value.trim() || null
    });
    if (error) {
      console.error("Erro ao enviar avaliação:", error);
      return setFeedback("review-feedback", "Não foi possível enviar agora. Tente novamente.", true);
    }
    event.target.reset();
    selectedRating = null;
    document.querySelectorAll("[data-star]").forEach(b => b.classList.remove("selected"));
    setFeedback("review-feedback", "Obrigado! Sua avaliação foi enviada.");
    await loadReviews();
  });

  async function loadStore() {
    const { data, error } = await supabase.from("store_settings").select("*").eq("id", 1).maybeSingle();
    if (error) console.error("Erro ao carregar dados da loja:", error);
    if (data) config = { whatsapp: data.whatsapp, instagram: data.instagram, address: data.address, maps: data.maps || "" };
    applyConfig();
  }

  async function loadMenu() {
    const { data, error } = await supabase.from("menu_items").select("*").order("sort_order").order("created_at");
    if (error) {
      console.error("Erro ao carregar cardápio:", error);
      return;
    }
    items = data?.length ? data : originalItems.map((item, i) => ({ ...item, id: `local-${i}` }));
    renderMenu();
  }

  async function loadReviews() {
    const { data, error } = await supabase.from("reviews")
      .select("id,customer_name,rating,message,created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) {
      console.error("Erro ao carregar avaliações:", error);
      return;
    }
    reviews = data || [];
    renderReviews();
  }

  async function loadAll() {
    await Promise.all([loadStore(), loadMenu(), loadReviews()]);
  }

  const overlay = $("admin-overlay");
  const login = $("admin-login");
  const content = $("admin-content");

  function showAdminLogin() {
    login.hidden = false;
    content.hidden = true;
    $("admin-login-error").textContent = "";
  }

  async function openAdmin() {
    overlay.classList.add("open");
    if (supabase && session) {
      const { data, error } = await supabase.rpc("is_bill_admin");
      if (!error && data === true) {
        isAdmin = true;
        login.hidden = true;
        content.hidden = false;
        await populateAdmin();
        return;
      }
    }
    showAdminLogin();
  }

  function closeAdmin() { overlay.classList.remove("open"); }
  $("open-admin").addEventListener("click", event => { event.preventDefault(); openAdmin(); });
  $("admin-close-login").onclick = closeAdmin;
  $("admin-close").onclick = closeAdmin;
  overlay.addEventListener("click", event => { if (event.target === overlay) closeAdmin(); });

  function fillCategories() {
    const all = [...categoryMeta, ...[...new Set(items.map(item => item.category))]
      .filter(id => !categoryMeta.some(category => category.id === id))
      .map(id => ({ id, title: id }))];
    $("item-category").innerHTML = all.map(category =>
      `<option value="${esc(category.id)}">${esc(category.title)}</option>`
    ).join("");
  }

  async function populateAdmin() {
    $("edit-whatsapp").value = config.whatsapp;
    $("edit-instagram").value = config.instagram;
    $("edit-address").value = config.address;
    fillCategories();

    const { data, error } = await supabase.from("menu_items").select("*").order("sort_order");
    if (error) {
      $("admin-item-list").textContent = "Erro ao carregar itens. Confira as políticas do Supabase.";
      return;
    }
    items = data || [];
    $("admin-item-list").innerHTML = items.map(item =>
      `<div class="admin-item">
        <div><b>${esc(item.name)}</b><small>${esc(item.category)} · ${esc(item.price)}</small></div>
        <div>
          <button type="button" class="admin-btn secondary" data-edit="${esc(item.id)}">Editar</button>
          <button type="button" class="admin-btn danger" data-del="${esc(item.id)}">Excluir</button>
        </div>
      </div>`
    ).join("") || "<p>Nenhum item cadastrado.</p>";

    document.querySelectorAll("[data-edit]").forEach(button =>
      button.onclick = () => editItem(button.dataset.edit)
    );
    document.querySelectorAll("[data-del]").forEach(button =>
      button.onclick = () => deleteItem(button.dataset.del)
    );
  }

  async function ensureInitialMenu() {
    const { data, error } = await supabase.from("menu_items").select("id").limit(1);
    if (error || data?.length) return;
    const seed = originalItems.map((item, index) => ({ ...item, sort_order: index }));
    const result = await supabase.from("menu_items").insert(seed);
    if (result.error) console.error("Não foi possível inicializar o cardápio:", result.error);
  }

  $("admin-login-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!supabase) return setFeedback("admin-login-error", "Configure primeiro as credenciais do Supabase.", true);
    const button = $("admin-login-btn");
    button.disabled = true;
    setFeedback("admin-login-error", "Verificando acesso...");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: $("admin-email").value.trim(),
        password: $("admin-password").value
      });
      if (error) throw error;
      session = data.session;
      const { data: allowed, error: roleError } = await supabase.rpc("is_bill_admin");
      if (roleError || allowed !== true) {
        await supabase.auth.signOut();
        session = null;
        throw new Error("Este usuário não está cadastrado como administrador.");
      }
      isAdmin = true;
      await ensureInitialMenu();
      await loadAll();
      login.hidden = true;
      content.hidden = false;
      await populateAdmin();
    } catch (error) {
      setFeedback("admin-login-error", error.message || "Não foi possível entrar. Confira e-mail e senha.", true);
    } finally {
      button.disabled = false;
    }
  });

  $("admin-logout").onclick = async () => {
    if (supabase) await supabase.auth.signOut();
    session = null;
    isAdmin = false;
    closeAdmin();
  };

  function clearItemForm() {
    $("item-form").reset();
    $("item-id").value = "";
    $("item-submit").textContent = "Adicionar item";
  }

  function editItem(id) {
    const item = items.find(entry => entry.id === id);
    if (!item) return;
    $("item-id").value = item.id;
    $("item-category").value = item.category;
    $("item-name").value = item.name;
    $("item-description").value = item.description || "";
    $("item-price").value = item.price;
    $("item-submit").textContent = "Salvar edição";
    $("item-form").scrollIntoView({ behavior: "smooth" });
  }

  async function deleteItem(id) {
    if (!isAdmin || !confirm("Excluir este item do cardápio?")) return;
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return alert("Não foi possível excluir. Confira as permissões do administrador.");
    await loadMenu();
    await populateAdmin();
  }

  $("item-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (!isAdmin) return alert("Acesso administrativo necessário.");
    const id = $("item-id").value;
    const item = {
      category: $("item-category").value,
      name: $("item-name").value.trim(),
      description: $("item-description").value.trim(),
      price: $("item-price").value.trim(),
      sort_order: id ? (items.find(entry => entry.id === id)?.sort_order ?? items.length) : items.length
    };
    const result = id
      ? await supabase.from("menu_items").update(item).eq("id", id)
      : await supabase.from("menu_items").insert(item);
    if (result.error) return alert("Erro ao salvar produto. Confira a conexão e as permissões.");
    clearItemForm();
    await loadMenu();
    await populateAdmin();
  });

  $("item-cancel").onclick = clearItemForm;

  $("save-store").onclick = async () => {
    if (!isAdmin) return alert("Acesso administrativo necessário.");
    const updated = {
      id: 1,
      whatsapp: $("edit-whatsapp").value.replace(/\D/g, ""),
      instagram: $("edit-instagram").value.trim(),
      address: $("edit-address").value.trim(),
      maps: ""
    };
    const { error } = await supabase.from("store_settings").upsert(updated);
    if (error) return alert("Não foi possível salvar as informações. Confira as permissões.");
    config = { ...config, ...updated };
    applyConfig();
    alert("Informações da loja atualizadas para todos os visitantes.");
  };

  $("export-data").onclick = async () => {
    if (!isAdmin) return alert("Acesso administrativo necessário.");
    const [store, menu, review] = await Promise.all([
      supabase.from("store_settings").select("*"),
      supabase.from("menu_items").select("*"),
      supabase.from("reviews").select("*")
    ]);
    if (store.error || menu.error || review.error) return alert("Não foi possível gerar o backup.");
    const blob = new Blob([JSON.stringify({ config: store.data, items: menu.data, reviews: review.data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "backup-bill-burger.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  $("reset-menu").onclick = async () => {
    if (!isAdmin || !confirm("Restaurar o cardápio original? Os itens atuais serão substituídos.")) return;
    const { error } = await supabase.from("menu_items").delete().gte("sort_order", -2147483648);
    if (error) return alert("Não foi possível restaurar o cardápio.");
    await ensureInitialMenu();
    await loadMenu();
    await populateAdmin();
  };

  async function start() {
    $("year").textContent = new Date().getFullYear();
    if (!ready) {
      applyConfig();
      renderMenu();
      renderReviews();
      showConnectionError();
      return;
    }
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      await loadAll();
      const { data } = await supabase.auth.getSession();
      session = data.session;
      supabase.auth.onAuthStateChange((_event, newSession) => {
        session = newSession;
        if (!newSession) isAdmin = false;
      });
    } catch (error) {
      console.error("Falha ao iniciar Supabase:", error);
      applyConfig();
      renderMenu();
      renderReviews();
      showConnectionError();
    }
  }
  start();
})();
