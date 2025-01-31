// app.js

let currentUser = null;
let sessionToken = null;
let disableAutoRefresh = false;
let trackingIdSurtido = null;
let trackingIdEmpaque = null;
let trackingIdEmbarque = null;
let currentSectionId = null; // Para animaciones

// -------------------- NOTIFICACIONES --------------------
async function requestNotificationPermission() {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification("Notificaciones activadas");
    }
  }
}

function showNotification(msg) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(msg);
  }
}

// Simulación de notificación en servidor (opcional)
async function notifyNewPedido() {
  showNotification("Nuevo pedido registrado");
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Nuevo pedido registrado" })
    });
  } catch {}
}

// -------------------- MODAL DE ERRORES --------------------
function showErrorModal(message) {
  const modal = document.getElementById("error-modal");
  const msgElem = document.getElementById("error-modal-msg");
  msgElem.textContent = message;
  modal.style.display = "block";
}

function closeErrorModal() {
  document.getElementById("error-modal").style.display = "none";
}

// -------------------- DOMContentLoaded --------------------
document.addEventListener("DOMContentLoaded", () => {
  requestNotificationPermission();

  // Botón cerrar modal error
  const modalCloseBtn = document.getElementById("error-modal-close");
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", () => {
      closeErrorModal();
    });
  }

  const savedToken = localStorage.getItem("revko_token");
  const savedUser = localStorage.getItem("revko_user");
  const savedSurtidoTracking = localStorage.getItem("revko_surtido_tracking");
  const savedEmpaqueTracking = localStorage.getItem("revko_empaque_tracking");
  const savedEmbarqueTracking = localStorage.getItem("revko_embarque_tracking");

  if (savedToken && savedUser) {
    sessionToken = savedToken;
    currentUser = JSON.parse(savedUser);
    document.getElementById("login-section").style.display = "none";
    document.getElementById("main-content").style.display = "block";
    document.getElementById("sidebar").classList.add("show");
    document.getElementById("toggleSidebarBtn").style.display = "block";
    setupMenuByRole(currentUser);
    mostrarFotoYNombre(currentUser);
    refreshAllSections();
    loadUsuariosFiltro();
  } else {
    // No hay sesión => ocultamos sidebar y el botón
    document.getElementById("sidebar").classList.remove("show");
    document.getElementById("toggleSidebarBtn").style.display = "none";
  }

  if (savedSurtidoTracking) {
    trackingIdSurtido = savedSurtidoTracking;
  }
  if (savedEmpaqueTracking) {
    trackingIdEmpaque = savedEmpaqueTracking;
  }
  if (savedEmbarqueTracking) {
    trackingIdEmbarque = savedEmbarqueTracking;
  }

  // Sidebar toggle
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  if (toggleSidebarBtn) {
    toggleSidebarBtn.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("show");
    });
  }

  // Botón cerrar menú
  const closeMenuBtn = document.createElement("button");
  closeMenuBtn.textContent = "CERRAR MENÚ";
  closeMenuBtn.classList.add("btn");
  closeMenuBtn.style.margin = "0.5rem 1rem";
  closeMenuBtn.addEventListener("click", () => {
    document.getElementById("sidebar").classList.remove("show");
  });
  const sidebar = document.getElementById("sidebar");
  sidebar.insertBefore(closeMenuBtn, sidebar.querySelector("hr"));

  // -------------------- LOGIN --------------------
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usuario = document.getElementById("usuario").value.trim();
      const password = document.getElementById("password").value.trim();
      try {
        const resp = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario, password }),
        });
        const data = await resp.json();
        if (data.ok) {
          currentUser = data.user;
          sessionToken = btoa(usuario + ":" + password + ":" + Date.now());
          localStorage.setItem("revko_token", sessionToken);
          localStorage.setItem("revko_user", JSON.stringify(currentUser));
          document.getElementById("login-section").style.display = "none";
          document.getElementById("main-content").style.display = "block";
          document.getElementById("sidebar").classList.add("show");
          document.getElementById("toggleSidebarBtn").style.display = "block";
          setupMenuByRole(currentUser);
          mostrarFotoYNombre(currentUser);
          refreshAllSections();
          loadUsuariosFiltro();
        } else {
          showErrorModal("USUARIO O CONTRASEÑA INCORRECTOS");
        }
      } catch {
        showErrorModal("Error de conexión o servidor.");
      }
    });
  }

  // -------------------- LOGOUT --------------------
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/logout", { method: "POST" });
        const data = await resp.json();
        if (data.ok) {
          sessionToken = null;
          currentUser = null;
          localStorage.removeItem("revko_token");
          localStorage.removeItem("revko_user");
          localStorage.removeItem("revko_surtido_tracking");
          localStorage.removeItem("revko_empaque_tracking");
          localStorage.removeItem("revko_embarque_tracking");
          document.getElementById("login-section").style.display = "block";
          document.getElementById("main-content").style.display = "none";
          document.getElementById("sidebar").classList.remove("show");
          document.getElementById("toggleSidebarBtn").style.display = "none";
        }
      } catch {}
    });
  }

  // -------------------- NAVEGACIÓN DE SECCIONES (con animación) --------------------
  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      showSectionWithAnimation(target);
      document.getElementById("sidebar").classList.remove("show");
    });
  });

  function showSectionWithAnimation(sectionId) {
    if (currentSectionId === sectionId) return;
    const oldSection = document.getElementById(currentSectionId);
    const newSection = document.getElementById(sectionId);

    if (oldSection) {
      oldSection.classList.remove("slide-in-right");
      oldSection.classList.add("slide-out-left");
      oldSection.addEventListener("animationend", function handleOldAnimEnd() {
        oldSection.removeEventListener("animationend", handleOldAnimEnd);
        oldSection.style.display = "none";
        oldSection.classList.remove("slide-out-left");
      });
    }
    newSection.style.display = "block";
    newSection.classList.remove("slide-out-left");
    newSection.classList.add("slide-in-right");
    currentSectionId = sectionId;
  }

  // -------------------- PEDIDOS --------------------
  const btnRegistrarPedido = document.getElementById("btnRegistrarPedido");
  if (btnRegistrarPedido) {
    btnRegistrarPedido.addEventListener("click", async () => {
      const nuevoPedido = document.getElementById("pedido-nuevo").value.trim();
      if (!nuevoPedido) return;
      if (!confirm(`REGISTRAR PEDIDO ${nuevoPedido}?`)) return;
      try {
        const resp = await fetch("/api/pedidos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ numero: nuevoPedido }),
        });
        const data = await resp.json();
        alert(data.msg);
        document.getElementById("pedido-nuevo").value = "";
        refreshPedidos();
        refreshSurtido();
        notifyNewPedido();
      } catch {}
    });
  }

  // -------------------- SURTIDO --------------------
  const btnComenzarSurtido = document.getElementById("btnComenzarSurtido");
  const surtidoForm = document.getElementById("surtido-form");
  const surtidoPedidoNum = document.getElementById("surtido-pedido-num");
  const surtidoFechaHoraIni = document.getElementById("surtido-fecha-hora-ini");
  const surtidoObservaciones = document.getElementById("surtido-observaciones");
  const btnFinalizarSurtido = document.getElementById("btnFinalizarSurtido");

  btnComenzarSurtido?.addEventListener("click", async () => {
    const numeroPedido = prompt("INGRESA EL NÚMERO DE PEDIDO A SURTIR:");
    if (!numeroPedido) return;
    iniciarSurtido(numeroPedido);
  });

  window.startSurtido = (pedidoNumero) => {
    if (!confirm(`¿COMENZAR SURTIDO DEL PEDIDO ${pedidoNumero}?`)) return;
    iniciarSurtido(pedidoNumero);
  };

  async function iniciarSurtido(numeroPedido) {
    try {
      const ahora = new Date();
      const resp = await fetch("/api/surtido/comenzar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_numero: numeroPedido }),
      });
      const data = await resp.json();
      alert(data.msg);
      if (data.ok) {
        surtidoForm.style.display = "block";
        surtidoPedidoNum.innerText = numeroPedido;
        surtidoFechaHoraIni.innerText = ahora.toLocaleString();
        surtidoObservaciones.value = "";
        trackingIdSurtido = data.tracking_id;
        localStorage.setItem("revko_surtido_tracking", trackingIdSurtido);
        document.getElementById("surtido-disponibles").style.display = "none";
        refreshSurtido();
        refreshPedidos();
      }
    } catch {}
  }

  btnFinalizarSurtido?.addEventListener("click", async () => {
    if (!trackingIdSurtido) {
      alert("NO SE ENCONTRÓ TRACKING_ID EN PROGRESO.");
      return;
    }
    if (!confirm("¿FINALIZAR Y ENTREGAR PEDIDO AL ÁREA DE EMPAQUE?")) return;
    const obs = surtidoObservaciones.value.trim();
    try {
      const resp = await fetch("/api/surtido/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_id: trackingIdSurtido, observaciones: obs }),
      });
      const data = await resp.json();
      alert(data.msg);
      surtidoForm.style.display = "none";
      localStorage.removeItem("revko_surtido_tracking");
      trackingIdSurtido = null;
      document.getElementById("surtido-disponibles").style.display = "block";
      refreshSurtido();
      refreshPedidos();
      refreshEmpaque();
    } catch {}
  });

  // -------------------- EMPAQUE --------------------
  const btnComenzarEmpaque = document.getElementById("btnComenzarEmpaque");
  const empaqueForm = document.getElementById("empaque-form");
  const empaquePedidoNum = document.getElementById("empaque-pedido-num");
  const empaqueFechaHoraIni = document.getElementById("empaque-fecha-hora-ini");
  const empaqueCajas = document.getElementById("empaque-cajas");
  const empaquePallets = document.getElementById("empaque-pallets");
  const empaqueEstatus = document.getElementById("empaque-estatus");
  const empaqueObservaciones = document.getElementById("empaque-observaciones");
  const btnFinalizarEmpaque = document.getElementById("btnFinalizarEmpaque");

  btnComenzarEmpaque?.addEventListener("click", async () => {
    const numeroPedido = prompt("INGRESA EL NÚMERO DE PEDIDO A EMPACAR:");
    if (!numeroPedido) return;
    iniciarEmpaque(numeroPedido);
  });

  window.startEmpaque = (pedidoNumero) => {
    if (!confirm(`¿COMENZAR EMPAQUE DEL PEDIDO ${pedidoNumero}?`)) return;
    iniciarEmpaque(pedidoNumero);
  };

  async function iniciarEmpaque(numeroPedido) {
    try {
      const ahora = new Date();
      const resp = await fetch("/api/empaque/comenzar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedido_numero: numeroPedido }),
      });
      const data = await resp.json();
      alert(data.msg);
      if (data.ok) {
        empaqueForm.style.display = "block";
        empaquePedidoNum.innerText = numeroPedido;
        empaqueFechaHoraIni.innerText = ahora.toLocaleString();
        empaqueCajas.value = "0";
        empaquePallets.value = "0";
        empaqueEstatus.value = "COMPLETO";
        empaqueObservaciones.value = "";
        trackingIdEmpaque = data.tracking_id;
        localStorage.setItem("revko_empaque_tracking", trackingIdEmpaque);
        document.getElementById("empaque-disponibles").style.display = "none";
        refreshEmpaque();
        notifyNewPedido();
      }
    } catch {}
  }

  btnFinalizarEmpaque?.addEventListener("click", async () => {
    if (!trackingIdEmpaque) {
      alert("NO SE ENCONTRÓ TRACKING_ID EN PROGRESO.");
      return;
    }
    if (!confirm("¿FINALIZAR EL EMPAQUE DE ESTE PEDIDO?")) return;
    const cajas = empaqueCajas.value.trim() || "0";
    const pallets = empaquePallets.value.trim() || "0";
    const estatus = empaqueEstatus.value;
    const observ = empaqueObservaciones.value.trim();
    try {
      const resp = await fetch("/api/empaque/finalizar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_id: trackingIdEmpaque,
          cajas,
          pallets,
          estatus,
          observaciones: observ
        }),
      });
      const data = await resp.json();
      alert(data.msg);
      empaqueForm.style.display = "none";
      localStorage.removeItem("revko_empaque_tracking");
      trackingIdEmpaque = null;
      document.getElementById("empaque-disponibles").style.display = "block";
      refreshEmpaque();
      manualRefreshEmbarque();
    } catch {}
  });

  // Reabrir Surtido / Empaque
  window.reabrirSurtido = async function(tid) {
    if (!confirm("¿REABRIR SURTIDO? Esto ELIMINARÁ el proceso en curso.")) return;
    try {
      const resp = await fetch("/api/surtido/reabrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_id: tid, cancel: true })
      });
      const data = await resp.json();
      alert(data.msg);
      if (data.ok) {
        localStorage.removeItem("revko_surtido_tracking");
        trackingIdSurtido = null;
        refreshSurtido();
        refreshPedidos();
      }
    } catch {}
  };

  window.reabrirEmpaque = async function(tid) {
    if (!confirm("¿REABRIR EMPAQUE? Esto ELIMINARÁ el proceso en curso.")) return;
    try {
      const resp = await fetch("/api/empaque/reabrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracking_id: tid, cancel: true })
      });
      const data = await resp.json();
      alert(data.msg);
      if (data.ok) {
        localStorage.removeItem("revko_empaque_tracking");
        trackingIdEmpaque = null;
        refreshEmpaque();
        refreshSurtido();
        refreshPedidos();
      }
    } catch {}
  };

  // -------------------- EMBARQUE --------------------
  const embarqueForm = document.getElementById("embarque-form");
  const embarqueEntregaLocal = document.getElementById("embarque-entrega-local");
  const embarquePedidoNum = document.getElementById("embarque-pedido-num");
  const embarquePedidoNum2 = document.getElementById("embarque-pedido-num-2");
  const embarqueTipoSalida = document.getElementById("embarque-tipo-salida");
  const embarqueFechaCita = document.getElementById("embarque-fecha-cita");
  const embarqueObservaciones = document.getElementById("embarque-observaciones");
  const btnConfirmarSalida = document.getElementById("btnConfirmarSalida");
  const embarqueLocalExtra = document.getElementById("embarque-local-extra");
  const embarqueObsEntrega = document.getElementById("embarque-observaciones-entrega");
  const btnConfirmarEntregaLocal = document.getElementById("btnConfirmarEntregaLocal");

  embarqueTipoSalida?.addEventListener("change", () => {
    if (embarqueTipoSalida.value.toLowerCase() === "local") {
      embarqueLocalExtra.style.display = "block";
    } else {
      embarqueLocalExtra.style.display = "none";
    }
  });

  btnConfirmarSalida?.addEventListener("click", async () => {
    if (!trackingIdEmbarque) {
      alert("NO SE ENCONTRÓ TRACKING_ID EN EMBARQUE.");
      return;
    }
    const tipo_salida = embarqueTipoSalida.value.toLowerCase();
    const obs_sal = embarqueObservaciones.value.trim();
    const f_cita = embarqueFechaCita.value || "";
    try {
      const resp = await fetch("/api/embarque/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_id: trackingIdEmbarque,
          tipo_salida,
          observaciones_salida: obs_sal,
          fecha_cita: f_cita
        }),
      });
      const data = await resp.json();
      alert(data.msg);
      embarqueForm.style.display = "none";
      if (tipo_salida === "local") {
        trackingIdEmbarque = data.tracking_id_local || trackingIdEmbarque;
        localStorage.setItem("revko_embarque_tracking", trackingIdEmbarque);
      } else {
        localStorage.removeItem("revko_embarque_tracking");
        trackingIdEmbarque = null;
      }
      manualRefreshEmbarque();
    } catch {}
  });

  btnConfirmarEntregaLocal?.addEventListener("click", async () => {
    if (!trackingIdEmbarque) {
      alert("NO SE ENCONTRÓ TRACKING_ID LOCAL PENDIENTE.");
      return;
    }
    const obsEnt = embarqueObsEntrega.value.trim();
    try {
      const resp = await fetch("/api/embarque/entrega_local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracking_id: trackingIdEmbarque,
          observaciones_entrega: obsEnt
        }),
      });
      const data = await resp.json();
      alert(data.msg);
      embarqueEntregaLocal.style.display = "none";
      localStorage.removeItem("revko_embarque_tracking");
      trackingIdEmbarque = null;
      manualRefreshEmbarque();
    } catch {}
  });

  // Refresco automático
  setInterval(() => {
    if (currentUser && !disableAutoRefresh) {
      refreshPedidos();
      refreshSurtido();
      refreshEmpaque();
      refreshDashboard();
      refreshConfigUsuarios();
    }
  }, 3000);

  function refreshAllSections() {
    refreshPedidos();
    refreshSurtido();
    refreshEmpaque();
    refreshDashboard();
    refreshConfigUsuarios();
    manualRefreshEmbarque();
  }
  function manualRefreshEmbarque() {
    refreshEmbarque();
  }

  // -------------------- PEDIDOS --------------------
  async function refreshPedidos() {
    try {
      const resp = await fetch("/api/pedidos");
      const data = await resp.json();
      const cont = document.getElementById("pedidos-lista");
      if (!cont) return;
      let html = "<h3>LISTADO</h3>";
      if (data.length === 0) {
        html += "<p>NO HAY PEDIDOS REGISTRADOS</p>";
      } else {
        html += `<div class="table-wrapper"><table>
          <tr><th>PEDIDO</th><th>USUARIO</th><th>FECHA</th><th>HORA</th></tr>`;
        data.forEach((p) => {
          html += `<tr>
            <td>${p.numero}</td>
            <td>${p.usuario_registro}</td>
            <td>${p.fecha_registro}</td>
            <td>${p.hora_registro}</td>
          </tr>`;
        });
        html += "</table></div>";
      }
      cont.innerHTML = html;
    } catch {}
  }

  // -------------------- SURTIDO (LISTAS) --------------------
  async function refreshSurtido() {
    // Disponibles
    try {
      const resp = await fetch("/api/surtido/disponibles");
      const data = await resp.json();
      const cont = document.getElementById("surtido-disponibles");
      if (!cont) return;
      let html = "<h3>PEDIDOS DISPONIBLES PARA SURTIR</h3>";
      if (data.length === 0) {
        html += "<p>NO HAY PEDIDOS PARA SURTIR</p>";
      } else {
        html += `<div class="table-wrapper"><table>
          <tr><th>PEDIDO</th><th>FECHA</th><th>HORA</th><th>ACCIÓN</th></tr>`;
        data.forEach((p) => {
          html += `<tr>
            <td>${p.numero}</td>
            <td>${p.fecha_registro}</td>
            <td>${p.hora_registro}</td>
            <td><button class="btn" onclick="startSurtido('${p.numero}')">COMENZAR</button></td>
          </tr>`;
        });
        html += "</table></div>";
      }
      cont.innerHTML = html;
    } catch {}

    // En progreso
    try {
      const resp = await fetch("/api/surtido/enprogreso");
      const data = await resp.json();
      const cont = document.getElementById("surtido-enprogreso");
      if (!cont) return;
      let html = "<h3>PEDIDOS EN PROGRESO</h3>";
      if (data.length === 0) {
        html += "<p>NO TIENES PEDIDOS EN PROGRESO DE SURTIDO</p>";
        trackingIdSurtido = null;
        localStorage.removeItem("revko_surtido_tracking");
      } else {
        html += `<div class="table-wrapper"><table>
          <tr><th>TRACKINGID</th><th>PEDIDO</th><th>INICIO</th><th>OBSERVACIONES</th><th>REABRIR</th></tr>`;
        data.forEach((sp) => {
          html += `<tr>
            <td>${sp.tracking_id}</td>
            <td>${sp.numero}</td>
            <td>${sp.fecha_inicio} ${sp.hora_inicio}</td>
            <td>${sp.observaciones || ""}</td>
            <td><button class="btn" onclick="reabrirSurtido(${sp.tracking_id})">REABRIR</button></td>
          </tr>`;
          trackingIdSurtido = sp.tracking_id;
          localStorage.setItem("revko_surtido_tracking", trackingIdSurtido);
        });
        html += "</table></div>";
      }
      cont.innerHTML = html;
    } catch {}
  }

  // -------------------- EMPAQUE (LISTAS) --------------------
  async function refreshEmpaque() {
    // Disponibles
    try {
      const resp = await fetch("/api/empaque/disponibles");
      const data = await resp.json();
      const cont = document.getElementById("empaque-disponibles");
      if (!cont) return;
      let html = "<h3>PEDIDOS DISPONIBLES PARA EMPACAR</h3>";
      if (data.length === 0) {
        html += "<p>NO HAY PEDIDOS POR EMPACAR</p>";
      } else {
        html += `<div class="table-wrapper"><table>
          <tr><th>PEDIDO</th><th>FIN SURTIDO</th><th>ACCIÓN</th></tr>`;
        data.forEach((e) => {
          html += `<tr>
            <td>${e.numero}</td>
            <td>${e.fecha_fin} ${e.hora_fin}</td>
            <td><button class="btn" onclick="startEmpaque('${e.numero}')">COMENZAR</button></td>
          </tr>`;
        });
        html += "</table></div>";
      }
      cont.innerHTML = html;
    } catch {}

    // En progreso
    try {
      const resp = await fetch("/api/empaque/enprogreso");
      const data = await resp.json();
      const cont = document.getElementById("empaque-enprogreso");
      if (!cont) return;
      let html = "<h3>PEDIDOS EN PROGRESO</h3>";
      if (data.length === 0) {
        html += "<p>NO TIENES PEDIDOS EN PROGRESO DE EMPAQUE</p>";
        trackingIdEmpaque = null;
        localStorage.removeItem("revko_empaque_tracking");
      } else {
        html += `<div class="table-wrapper"><table>
          <tr><th>TRACKINGID</th><th>PEDIDO</th><th>INICIO</th><th>CAJAS</th><th>PALLETS</th><th>ESTATUS</th><th>OBSERVACIONES</th><th>REABRIR</th></tr>`;
        data.forEach((ep) => {
          html += `<tr>
            <td>${ep.tracking_id}</td>
            <td>${ep.numero}</td>
            <td>${ep.fecha_inicio} ${ep.hora_inicio}</td>
            <td>${ep.cajas}</td>
            <td>${ep.pallets}</td>
            <td>${ep.estatus}</td>
            <td>${ep.observaciones || ""}</td>
            <td><button class="btn" onclick="reabrirEmpaque(${ep.tracking_id})">REABRIR</button></td>
          </tr>`;
          trackingIdEmpaque = ep.tracking_id;
          localStorage.setItem("revko_empaque_tracking", trackingIdEmpaque);
        });
        html += "</table></div>";
      }
      cont.innerHTML = html;
    } catch {}
  }

  // -------------------- EMBARQUE (LISTAS) --------------------
  async function refreshEmbarque() {
    try {
      const resp = await fetch("/api/embarque/disponibles");
      const data = await resp.json();
      const cont = document.getElementById("embarque-pendientes");
      if (!cont) return;
      let html = "<h3>PEDIDOS PENDIENTES POR CONFIRMAR SALIDA/ENTREGA</h3>";
      if (data.length === 0) {
        html += "<p>NO HAY PEDIDOS PENDIENTES POR CONFIRMAR SALIDA</p>";
      } else {
        html += `<div class="table-wrapper"><table>
          <tr><th>TRACKINGID</th><th>PEDIDO</th><th>FIN EMPAQUE</th><th>CAJAS</th><th>PALLETS</th><th>ESTATUS</th><th>OBS EMPAQUE</th><th>ACCIÓN</th></tr>`;
        data.forEach((de) => {
          html += `<tr>
            <td>${de.tracking_id}</td>
            <td>${de.numero}</td>
            <td>${de.fecha_fin} ${de.hora_fin}</td>
            <td>${de.cajas}</td>
            <td>${de.pallets}</td>
            <td>${de.estatus}</td>
            <td>${de.observaciones || ""}</td>
            <td>
              ${(!de.tipo_salida || de.tipo_salida === "") 
                ? `<button class="btn" onclick="seleccionarEmbarque(${de.tracking_id},'${de.numero}')">CONFIRMAR SALIDA</button>` 
                : ""}
              ${de.tipo_salida === 'local-pendiente' 
                ? `<button class="btn" onclick="seleccionarEntregaLocal(${de.tracking_id},'${de.numero}')">CONFIRMA ENTREGA</button>` 
                : ""}
            </td>
          </tr>`;
        });
        html += "</table></div>";
      }
      cont.innerHTML = html;
    } catch {}
  }

  window.seleccionarEmbarque = function(tid, numero) {
    trackingIdEmbarque = tid;
    localStorage.setItem("revko_embarque_tracking", trackingIdEmbarque);
    embarquePedidoNum.innerText = numero;
    embarqueForm.style.display = "block";
    embarqueEntregaLocal.style.display = "none";
  };

  window.seleccionarEntregaLocal = function(tid, numero) {
    trackingIdEmbarque = tid;
    localStorage.setItem("revko_embarque_tracking", trackingIdEmbarque);
    embarquePedidoNum2.innerText = numero;
    embarqueForm.style.display = "none";
    embarqueEntregaLocal.style.display = "block";
  };

  // -------------------- REPORTES --------------------
  document.getElementById("btnFiltrarReportes")?.addEventListener("click", () => {
    refreshReportes();
  });
  document.getElementById("btnLimpiarFiltro")?.addEventListener("click", () => {
    document.getElementById("filtro-pedido").value = "";
    document.getElementById("filtro-fecha-inicial").value = "";
    document.getElementById("filtro-fecha-final").value = "";
    document.getElementById("filtro-usuario").value = "";
    refreshReportes();
  });
  document.getElementById("btnExportarExcel")?.addEventListener("click", () => {
    exportarReportesCSV();
  });

  async function refreshReportes() {
    const pedido = document.getElementById("filtro-pedido").value.trim();
    const fechaIni = document.getElementById("filtro-fecha-inicial").value;
    const fechaFin = document.getElementById("filtro-fecha-final").value;
    const usuario = document.getElementById("filtro-usuario").value;
    try {
      const params = new URLSearchParams({
        pedido,
        fecha_ini: fechaIni,
        fecha_fin: fechaFin,
        usuario
      });
      const resp = await fetch(`/api/reportes?${params.toString()}`);
      const data = await resp.json();
      const cont = document.getElementById("reportes-container");
      if (!cont) return;
      let html = "<h3>RESULTADOS DE REPORTE</h3>";
      if (data.length === 0) {
        html += "<p>NO HAY RESULTADOS</p>";
      } else {
        html += `<div class="table-wrapper"><table>
          <tr>
            <th>PEDIDO</th><th>IMPRESIÓN</th><th>SURTIDOR</th><th>SURTIDO INICIO</th><th>SURTIDO FIN</th><th>TIEMPO SURTIDO</th><th>OBS SURTIDO</th>
            <th>EMPAQUE USER</th><th>EMPAQUE INICIO</th><th>EMPAQUE FIN</th><th>TIEMPO EMPAQUE</th><th>CAJAS</th><th>PALLETS</th>
            <th>ESTATUS</th><th>OBS EMPAQUE</th><th>INCIDENCIAS</th><th>SALIDA FECHA/HORA</th><th>TIPO SALIDA</th><th>OBS SALIDA</th><th>TIEMPO TOTAL</th>
          </tr>`;
        data.forEach((r) => {
          html += `<tr>
            <td>${r.pedido}</td>
            <td>${r.impresion_fecha}</td>
            <td>${r.surtidor}</td>
            <td>${r.surtido_inicio}</td>
            <td>${r.surtido_fin}</td>
            <td>${r.surtido_tiempo}</td>
            <td>${r.surtido_observ}</td>
            <td>${r.empaque_user}</td>
            <td>${r.empaque_inicio}</td>
            <td>${r.empaque_fin}</td>
            <td>${r.empaque_tiempo}</td>
            <td>${r.empaque_cajas}</td>
            <td>${r.empaque_pallets}</td>
            <td>${r.empaque_estatus}</td>
            <td>${r.empaque_observ}</td>
            <td>${r.empaque_incidencias || "0"}</td>
            <td>${r.salida_fecha}</td>
            <td>${r.salida_tipo}</td>
            <td>${r.salida_observ}</td>
            <td>${r.tiempo_total || ""}</td>
          </tr>`;
        });
        html += "</table></div>";
      }
      cont.innerHTML = html;
    } catch {}
  }

  function exportarReportesCSV() {
    const cont = document.getElementById("reportes-container");
    if (!cont) return;
    const rows = Array.from(cont.querySelectorAll("table tr"));
    let csv = [];
    rows.forEach((row) => {
      let cols = Array.from(row.querySelectorAll("th, td")).map((cell) =>
        cell.innerText.replace(/,/g, " ")
      );
      csv.push(cols.join(","));
    });
    let csvContent = "data:text/csv;charset=utf-8," + csv.join("\n");
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reportes_revko.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // -------------------- DASHBOARD --------------------
  async function refreshDashboard() {
    const now = new Date();
    const dias = ["DOMINGO","LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO"];
    const meses = ["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
    const diaSemana = dias[now.getDay()];
    const diaNum = now.getDate();
    const mes = meses[now.getMonth()];
    const anio = now.getFullYear();

    let hh = now.getHours();
    const mm = now.getMinutes().toString().padStart(2, "0");
    const ss = now.getSeconds().toString().padStart(2, "0");
    const ampm = hh < 12 ? "a.m." : "p.m.";
    if (hh === 0) hh = 12;
    if (hh > 12) hh -= 12;
    const hora12 = hh.toString().padStart(2, "0") + ":" + mm + ":" + ss + " " + ampm;

    const fechaElem = document.getElementById("fecha-actual");
    if (fechaElem) fechaElem.innerText = `${diaSemana} ${diaNum} DE ${mes} DEL ${anio}`;

    const horaElem = document.getElementById("hora-actual");
    if (horaElem) horaElem.innerText = hora12;

    try {
      const resp = await fetch("/api/dashboard");
      const data = await resp.json();

      // Llenamos la tabla de la izquierda
      document.getElementById("dash-total-pedidos").innerText = data.total_pedidos;
      document.getElementById("dash-pend-surtir").innerText = data.pendientes_surtir;
      document.getElementById("dash-pend-empaque").innerText = data.pendientes_empaque;
      document.getElementById("dash-pend-embarque").innerText = data.pendientes_embarcar;

      // A la derecha
      document.getElementById("dash-tiempo-promedio").innerText = data.tiempo_promedio_global;
      document.getElementById("dash-cumplimiento").innerText = data.cumplimiento_porcentaje + "%";

      // SURTIDORES (tabla inferior)
      const cont = document.getElementById("dashboard-info");
      if (!cont) return;

      let htmlSurt = `
        <div class="table-wrapper">
          <table style="border:2px solid #444;">
            <tr>
              <th>USUARIO</th>
              <th>FOTO</th>
              <th>PEDIDOS SURTIDOS</th>
              <th>INCIDENCIAS</th>
              <th>TIEMPO PROMEDIO</th>
            </tr>
      `;
      data.surtidores.forEach((s) => {
        const foto = s.foto ? `<img src="/fotos/${s.foto}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />` : "";
        htmlSurt += `<tr>
          <td>${s.usuario}</td>
          <td>${foto}</td>
          <td>${s.cantidad}</td>
          <td>${s.incidencias || 0}</td>
          <td>${s.tiempo_promedio || "0h 0m"}</td>
        </tr>`;
      });
      htmlSurt += "</table></div>";
      cont.innerHTML = htmlSurt;

      // EMPACADORES en otro contenedor (dashboard-empacadores)
      const contE = document.getElementById("dashboard-empacadores");
      if (contE) {
        let htmlEmp = `
          <div class="table-wrapper">
            <table style="border:2px solid #444;">
              <tr>
                <th>USUARIO</th>
                <th>FOTO</th>
                <th>PEDIDOS EMPACADOS</th>
                <th>CAJAS</th>
                <th>PALLETS</th>
                <th>TIEMPO PROMEDIO</th>
              </tr>
        `;
        data.empacadores.forEach((e) => {
          const foto = e.foto ? `<img src="/fotos/${e.foto}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />` : "";
          htmlEmp += `<tr>
            <td>${e.usuario}</td>
            <td>${foto}</td>
            <td>${e.cantidad}</td>
            <td>${e.sum_cajas || 0}</td>
            <td>${e.sum_pallets || 0}</td>
            <td>${e.tiempo_promedio || "0h 0m"}</td>
          </tr>`;
        });
        htmlEmp += "</table></div>";
        contE.innerHTML = htmlEmp;
      }
    } catch {}
  }

  // -------------------- CONFIGURACIÓN USUARIOS --------------------
  const btnCrearUsuario = document.getElementById("btnCrearUsuario");
  if (btnCrearUsuario) {
    btnCrearUsuario.addEventListener("click", async () => {
      const nombre = document.getElementById("nuevo-usuario-nombre").value.trim();
      const pass = document.getElementById("nuevo-usuario-pass").value.trim();
      const tipo = document.getElementById("nuevo-usuario-tipo").value;
      const fileInput = document.getElementById("nuevo-usuario-foto");
      if (!nombre || !pass || !tipo) {
        alert("FALTAN CAMPOS");
        return;
      }
      const checkboxes = document
        .getElementById("nuevo-usuario-secciones")
        .querySelectorAll("input[type='checkbox']");
      let accesos = [];
      checkboxes.forEach((ch) => {
        if (ch.checked) accesos.push(ch.value);
      });

      try {
        let formData = new FormData();
        formData.append("nombre", nombre);
        formData.append("password", pass);
        formData.append("tipo", tipo);
        formData.append("accesos", JSON.stringify(accesos));
        if (fileInput.files.length > 0) {
          formData.append("foto", fileInput.files[0]);
        }
        const resp = await fetch("/api/config/crear_usuario", {
          method: "POST",
          body: formData
        });
        const data = await resp.json();
        alert(data.msg);
        refreshConfigUsuarios();
      } catch {}
    });
  }

  const btnDescargarDB = document.getElementById("btnDescargarDB");
  if (btnDescargarDB) {
    btnDescargarDB.addEventListener("click", () => {
      window.open("/api/config/download_db", "_blank");
    });
  }

  async function refreshConfigUsuarios() {
    if (!currentUser || currentUser.tipo.toLowerCase() !== "master") return;
    try {
      const resp = await fetch("/api/config/usuarios");
      const data = await resp.json();
      const cont = document.getElementById("config-usuarios-lista");
      if (!cont) return;

      let html = "<h3>USUARIOS EXISTENTES</h3>";
      if (data.length === 0) {
        html += "<p>NO HAY USUARIOS</p>";
      } else {
        html += `
          <div id="config-usuarios-lista-table" class="table-wrapper">
            <table>
              <tr><th>ID</th><th>NOMBRE</th><th>TIPO</th><th>FOTO</th><th>ACCIONES</th></tr>
        `;
        data.forEach((u) => {
          const foto = u.foto ? `<img src="/fotos/${u.foto}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" />` : "";
          html += `<tr>
            <td>${u.id}</td>
            <td>${u.nombre}</td>
            <td>${u.tipo}</td>
            <td>${foto}</td>
            <td>
              <button class="btn" onclick="mostrarEditarUsuario(${u.id}, '${u.nombre}', '${u.tipo}', '${u.foto||''}', '${u.accesos||''}')">EDITAR</button>
              ${u.nombre !== "master" ? `
                <button class="btn" onclick="eliminarUsuario(${u.id})">ELIMINAR</button>
              ` : ""}
            </td>
          </tr>`;
        });
        html += `</table></div>`;
        html += `
          <div id="edit-user-form" style="display:none; margin-top:1rem;">
            <h4>EDITAR USUARIO</h4>
            <input type="hidden" id="edit-user-id" />
            <label>NOMBRE:</label>
            <input type="text" id="edit-user-nombre" style="text-transform:none;" />
            <label>CONTRASEÑA:</label>
            <input type="text" id="edit-user-pass" style="text-transform:none;" />
            <label>TIPO:</label>
            <select id="edit-user-tipo">
              <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
              <option value="SURTIDO">SURTIDO</option>
              <option value="EMPAQUE">EMPAQUE</option>
              <option value="SUPERVISOR">SUPERVISOR</option>
              <option value="GERENTE">GERENTE</option>
              <option value="MASTER">MASTER</option>
            </select>
            <br />
            <label>SECCIONES CON ACCESO:</label>
            <div id="edit-user-secciones" style="margin-top:0.5rem;">
              <label><input type="checkbox" value="pedidos" />PEDIDOS</label>
              <label><input type="checkbox" value="surtido" />SURTIDO</label>
              <label><input type="checkbox" value="empaque" />EMPAQUE</label>
              <label><input type="checkbox" value="embarque" />EMBARQUE</label>
              <label><input type="checkbox" value="reportes" />REPORTES</label>
              <label><input type="checkbox" value="dashboard" />DASHBOARD</label>
              <label><input type="checkbox" value="config" />CONFIG</label>
              <label><input type="checkbox" value="admin_db" />ADMIN_DB</label>
            </div>
            <br />
            <label>NUEVA FOTO (.JPG):</label>
            <input type="file" id="edit-user-foto" accept="image/jpeg" style="text-transform:none;" />
            <br />
            <button class="btn" onclick="guardarEdicionUsuario()">GUARDAR CAMBIOS</button>
            <button class="btn" onclick="cancelarEdicionUsuario()">CANCELAR</button>
          </div>
        `;
      }
      cont.innerHTML = html;
    } catch {}
  }

  window.eliminarUsuario = async function(id) {
    if (!confirm("¿SEGURO QUE DESEAS ELIMINAR ESTE USUARIO?")) return;
    try {
      const resp = await fetch("/api/config/eliminar_usuario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: id }),
      });
      const data = await resp.json();
      alert(data.msg);
      refreshConfigUsuarios();
    } catch {}
  };

  window.mostrarEditarUsuario = function(id, nombre, tipo, foto, accesosStr) {
    disableAutoRefresh = true;
    const listaTabla = document.getElementById("config-usuarios-lista-table");
    if (listaTabla) listaTabla.style.display = "none";
    document.getElementById("edit-user-form").style.display = "block";
    document.getElementById("edit-user-id").value = id;
    document.getElementById("edit-user-nombre").value = nombre;
    document.getElementById("edit-user-tipo").value = tipo;
    document.getElementById("edit-user-pass").value = "";

    let accesos = [];
    try {
      accesos = JSON.parse(accesosStr);
    } catch(e){}
    const checkboxDiv = document.getElementById("edit-user-secciones");
    const checkboxes = checkboxDiv.querySelectorAll("input[type='checkbox']");
    checkboxes.forEach((ch) => {
      ch.checked = false;
      if (accesos.includes(ch.value)) {
        ch.checked = true;
      }
    });
  };

  window.cancelarEdicionUsuario = function() {
    document.getElementById("edit-user-form").style.display = "none";
    const listaTabla = document.getElementById("config-usuarios-lista-table");
    if (listaTabla) listaTabla.style.display = "block";
    disableAutoRefresh = false;
  };

  window.guardarEdicionUsuario = async function() {
    const id = document.getElementById("edit-user-id").value;
    const nombre = document.getElementById("edit-user-nombre").value.trim();
    const pass = document.getElementById("edit-user-pass").value.trim();
    const tipo = document.getElementById("edit-user-tipo").value;
    const fileInput = document.getElementById("edit-user-foto");

    const checkboxDiv = document.getElementById("edit-user-secciones");
    const checkboxes = checkboxDiv.querySelectorAll("input[type='checkbox']");
    let accesos = [];
    checkboxes.forEach((ch) => {
      if (ch.checked) accesos.push(ch.value);
    });

    if (!nombre) {
      alert("EL NOMBRE ES REQUERIDO.");
      return;
    }
    try {
      let formData = new FormData();
      formData.append("user_id", id);
      formData.append("nombre", nombre);
      formData.append("password", pass);
      formData.append("tipo", tipo);
      formData.append("accesos", JSON.stringify(accesos));
      if (fileInput.files.length > 0) {
        formData.append("foto", fileInput.files[0]);
      }
      const resp = await fetch("/api/config/editar_usuario", {
        method: "POST",
        body: formData
      });
      const data = await resp.json();
      alert(data.msg);
      if (data.ok) {
        document.getElementById("edit-user-form").style.display = "none";
        const listaTabla = document.getElementById("config-usuarios-lista-table");
        if (listaTabla) listaTabla.style.display = "block";
        disableAutoRefresh = false;
        refreshConfigUsuarios();
      }
    } catch {}
  };

  // -------------------- ADMIN DB --------------------
  window.listarTablas = async function() {
    const cont = document.getElementById("admin-db-container");
    cont.innerHTML = "<p>Cargando tablas...</p>";
    try {
      const resp = await fetch("/api/admin_db/tables");
      const data = await resp.json();
      if (data.ok && data.tables) {
        let html = "<h3>Tablas en la Base de Datos:</h3><ul>";
        data.tables.forEach((t) => {
          html += `<li>
            <button class="btn" onclick="cargarTabla('${t}')">${t}</button>
          </li>`;
        });
        html += "</ul>";
        cont.innerHTML = html;
      } else {
        cont.innerHTML = "<p>No se pudieron obtener tablas.</p>";
      }
    } catch {
      cont.innerHTML = "<p>Error listando tablas.</p>";
    }
  };

  window.cargarTabla = async function(nombreTabla) {
    const cont = document.getElementById("admin-db-container");
    cont.innerHTML = `<p>Cargando tabla ${nombreTabla}...</p>`;
    try {
      const resp = await fetch(`/api/admin_db/get_table?tabla=${nombreTabla}`);
      const data = await resp.json();
      if (data.ok && data.rows) {
        let html = `<h3>Tabla: ${nombreTabla}</h3>`;
        html += `<button class="btn" onclick="cargarTabla('${nombreTabla}')">REFRESCAR</button>`;
        if (data.rows.length === 0) {
          html += `<p>No hay registros en esta tabla.</p>`;
        } else {
          html += `<div class="table-wrapper"><table><tr>`;
          const columns = Object.keys(data.rows[0]);
          columns.forEach((col) => {
            html += `<th>${col}</th>`;
          });
          html += `<th>ACCIÓN</th></tr>`;
          data.rows.forEach((r) => {
            html += `<tr>`;
            columns.forEach((col) => {
              html += `<td>${r[col]}</td>`;
            });
            if (r.id !== undefined) {
              const rowDataStr = escapeRowData(JSON.stringify(r));
              html += `<td>
                <button class="btn" onclick="mostrarEditarFila('${nombreTabla}', ${r.id}, '${rowDataStr}')">EDITAR</button>
                <button class="btn" onclick="eliminarFila('${nombreTabla}', ${r.id})">ELIMINAR</button>
              </td>`;
            } else {
              html += `<td>-</td>`;
            }
            html += `</tr>`;
          });
          html += `</table></div>`;
        }
        html += `<div id="admin-db-edit-form" style="display:none; margin-top:1rem; border:1px solid #ccc; padding:1rem;"></div>`;
        cont.innerHTML = html;
      } else {
        cont.innerHTML = `<p>Error al cargar la tabla ${nombreTabla}.</p>`;
      }
    } catch {
      cont.innerHTML = `<p>Error al cargar la tabla ${nombreTabla}.</p>`;
    }
  };

  function escapeRowData(str) {
    return str.replace(/"/g, '&quot;').replace(/'/g,"&#39;");
  }

  window.mostrarEditarFila = function(tableName, rowId, rowDataStr) {
    const rowObj = JSON.parse(rowDataStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
    const editForm = document.getElementById("admin-db-edit-form");
    let html = `<h4>EDITAR FILA (ID=${rowId})</h4>`;
    html += `<p><strong>Tabla:</strong> ${tableName}</p>`;
    html += `<input type="hidden" id="edit-table-name" value="${tableName}" />`;
    html += `<input type="hidden" id="edit-row-id" value="${rowId}" />`;
    Object.keys(rowObj).forEach((col) => {
      if (col === "id") {
        html += `<p><strong>ID:</strong> ${rowObj[col]}</p>`;
      } else {
        html += `
          <label>${col}:</label>
          <input type="text" id="edit-col-${col}" value="${rowObj[col] || ""}" style="width:80%; margin-bottom:0.5rem;" />
          <br />
        `;
      }
    });
    html += `<button class="btn" onclick="guardarEdicionFila()">GUARDAR</button>`;
    html += `<button class="btn" onclick="cancelarEdicionFila()">CANCELAR</button>`;
    editForm.innerHTML = html;
    editForm.style.display = "block";
  };

  window.cancelarEdicionFila = function() {
    const editForm = document.getElementById("admin-db-edit-form");
    if (editForm) {
      editForm.innerHTML = "";
      editForm.style.display = "none";
    }
  };

  window.guardarEdicionFila = async function() {
    const editForm = document.getElementById("admin-db-edit-form");
    if (!editForm) return;
    const tableName = document.getElementById("edit-table-name").value;
    const rowId = document.getElementById("edit-row-id").value;
    const inputs = editForm.querySelectorAll("input[id^='edit-col-']");
    let updates = {};
    inputs.forEach((inp) => {
      const colName = inp.id.replace("edit-col-","");
      updates[colName] = inp.value;
    });
    try {
      const resp = await fetch("/api/admin_db/edit_row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: tableName,
          row_id: rowId,
          updates
        })
      });
      const data = await resp.json();
      alert(data.msg);
      if (data.ok) {
        cancelarEdicionFila();
        cargarTabla(tableName);
      }
    } catch(err) {
      console.log(err);
    }
  };

  window.eliminarFila = async function(tableName, rowId) {
    if (!confirm(`¿Eliminar la fila ID=${rowId} de la tabla ${tableName}?`)) return;
    try {
      const resp = await fetch("/api/admin_db/delete_row", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: tableName,
          row_id: rowId
        })
      });
      const data = await resp.json();
      alert(data.msg);
      if (data.ok) {
        cargarTabla(tableName);
      }
    } catch(err) {
      console.log(err);
    }
  };

  // -------------------- ROLES & MENÚ --------------------
  function setupMenuByRole(user) {
    document.getElementById("menu-pedidos").style.display = "none";
    document.getElementById("menu-surtido").style.display = "none";
    document.getElementById("menu-empaque").style.display = "none";
    document.getElementById("menu-embarque").style.display = "none";
    document.getElementById("menu-reportes").style.display = "none";
    document.getElementById("menu-dashboard").style.display = "none";
    document.getElementById("menu-config").style.display = "none";
    document.getElementById("menu-admin-db").style.display = "none";

    let accesos = [];
    try {
      accesos = JSON.parse(user.accesos);
    } catch(e){}

    if (accesos.includes("pedidos")) {
      document.getElementById("menu-pedidos").style.display = "block";
    }
    if (accesos.includes("surtido")) {
      document.getElementById("menu-surtido").style.display = "block";
    }
    if (accesos.includes("empaque")) {
      document.getElementById("menu-empaque").style.display = "block";
    }
    if (accesos.includes("embarque")) {
      document.getElementById("menu-embarque").style.display = "block";
    }
    if (accesos.includes("reportes")) {
      document.getElementById("menu-reportes").style.display = "block";
    }
    if (accesos.includes("dashboard")) {
      document.getElementById("menu-dashboard").style.display = "block";
    }
    if (accesos.includes("config")) {
      document.getElementById("menu-config").style.display = "block";
    }
    if (accesos.includes("admin_db")) {
      document.getElementById("menu-admin-db").style.display = "block";
    }
  }

  // Mostrar foto y nombre en Sidebar
  function mostrarFotoYNombre(user) {
    const userFotoElem = document.getElementById("userFoto");
    const userNombreElem = document.getElementById("userNombre");
    if (!userFotoElem || !userNombreElem) return;
    userFotoElem.style.display = "none";
    userFotoElem.src = "";
    userNombreElem.innerText = user.nombre.toUpperCase();
    if (user.foto) {
      userFotoElem.src = "/fotos/" + user.foto;
      userFotoElem.style.display = "block";
    }
  }

  // Para el filtro de usuario en REPORTES
  async function loadUsuariosFiltro() {
    try {
      const resp = await fetch("/api/config/usuarios");
      const data = await resp.json();
      const sel = document.getElementById("filtro-usuario");
      if (!sel) return;
      sel.innerHTML = "<option value=''>[TODOS]</option>";
      data.forEach(u => {
        sel.innerHTML += `<option value="${u.nombre}">${u.nombre}</option>`;
      });
    } catch (err) {}
  }
});