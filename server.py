#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sqlite3
from flask import Flask, request, jsonify, send_from_directory, g, session, send_file
from datetime import datetime
from werkzeug.utils import secure_filename
import json

app = Flask(__name__)
app.secret_key = "clave_super_secreta"

DATABASE = "db.db"
UPLOAD_FOLDER = "fotos"
ALLOWED_EXTENSIONS = {"jpg", "jpeg"}

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.',1)[1].lower() in ALLOWED_EXTENSIONS

def get_db():
    db = getattr(g, "_database", None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE, check_same_thread=False)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_db(exception):
    db = getattr(g, "_database", None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        c = db.cursor()

        # TABLA USUARIOS
        c.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE,
            password TEXT,
            tipo TEXT,
            foto TEXT
        )
        """)

        # Añadir columna accesos si no existe
        try:
            c.execute("ALTER TABLE usuarios ADD COLUMN accesos TEXT")
        except:
            pass

        # PEDIDOS
        c.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT UNIQUE,
            usuario_registro TEXT,
            fecha_registro TEXT,
            hora_registro TEXT
        )
        """)

        # TRACKING
        c.execute("""
        CREATE TABLE IF NOT EXISTS tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            etapa TEXT, 
            usuario TEXT,
            fecha_inicio TEXT,
            hora_inicio TEXT,
            fecha_fin TEXT,
            hora_fin TEXT,
            total_tiempo TEXT,
            cajas INTEGER DEFAULT 0,
            pallets INTEGER DEFAULT 0,
            estatus TEXT,
            observaciones TEXT,
            tipo_salida TEXT,
            fecha_salida TEXT,
            hora_salida TEXT,
            observaciones_salida TEXT
        )
        """)

        db.commit()

        # USUARIO MASTER POR DEFECTO
        c.execute("SELECT * FROM usuarios WHERE nombre='master'")
        if not c.fetchone():
            c.execute("INSERT INTO usuarios (nombre, password, tipo, foto, accesos) VALUES (?,?,?,?,?)",
                      ("master","root","master","", json.dumps(["pedidos","surtido","empaque","embarque","reportes","dashboard","config","admin_db"])))
            db.commit()

@app.route("/fotos/<filename>")
def serve_fotos(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route("/")
def root():
    return send_from_directory(".", "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(".", filename)

# -------------------- LOGIN / LOGOUT --------------------
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json()
    usuario = data.get("usuario","")
    password = data.get("password","")
    db = get_db()
    c = db.cursor()
    c.execute("SELECT * FROM usuarios WHERE nombre=? AND password=?", (usuario, password))
    row = c.fetchone()
    if row:
        session["user"] = row["nombre"]
        session["tipo"] = row["tipo"]
        foto = row["foto"] or ""
        accesos = row["accesos"] or "[]"
        return jsonify({
            "ok":True,
            "user":{
                "nombre":row["nombre"],
                "tipo":row["tipo"],
                "foto":foto,
                "accesos":accesos
            }
        })
    else:
        return jsonify({"ok":False,"msg":"USUARIO O CONTRASEÑA INCORRECTOS"})

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok":True,"msg":"SESIÓN CERRADA"})

# -------------------- PEDIDOS --------------------
@app.route("/api/pedidos", methods=["GET","POST"])
def api_pedidos():
    db = get_db()
    c = db.cursor()

    if request.method == "POST":
        data = request.get_json()
        numero = data.get("numero","").strip()
        if not numero:
            return jsonify({"ok":False,"msg":"NÚMERO DE PEDIDO INVÁLIDO"})
        c.execute("SELECT * FROM pedidos WHERE numero=?",(numero,))
        existe = c.fetchone()
        if existe:
            return jsonify({"ok":False,"msg":f"EL PEDIDO {numero} YA EXISTE."})
        ahora = datetime.now()
        fecha = ahora.strftime("%Y-%m-%d")
        hora = ahora.strftime("%H:%M:%S")
        user_reg = session.get("user","DESCONOCIDO")
        c.execute("""INSERT INTO pedidos (numero, usuario_registro, fecha_registro, hora_registro)
                     VALUES (?,?,?,?)""",(numero, user_reg, fecha, hora))
        db.commit()
        return jsonify({"ok":True,"msg":f"PEDIDO {numero} REGISTRADO CORRECTAMENTE."})

    # Retorna pedidos que no han terminado completamente
    c.execute("""
    SELECT p.*
    FROM pedidos p
    WHERE p.id NOT IN (
        SELECT t.pedido_id
        FROM tracking t
        WHERE (t.etapa='surtido' AND t.fecha_fin IS NOT NULL)
           OR (t.etapa='empaque' AND t.fecha_fin IS NOT NULL AND (t.fecha_salida IS NOT NULL AND t.fecha_salida<>'' ))
    )
    ORDER BY p.id DESC
    """)
    rows = c.fetchall()
    res = []
    for r in rows:
        res.append({
            "numero": r["numero"],
            "usuario_registro": r["usuario_registro"],
            "fecha_registro": r["fecha_registro"],
            "hora_registro": r["hora_registro"]
        })
    return jsonify(res)

# -------------------- SURTIDO --------------------
@app.route("/api/surtido/disponibles")
def surtido_disponibles():
    db = get_db()
    c = db.cursor()
    c.execute("""
    SELECT p.numero, p.fecha_registro, p.hora_registro
    FROM pedidos p
    WHERE p.id NOT IN (
      SELECT t.pedido_id FROM tracking t WHERE t.etapa='surtido'
    )
    AND p.id NOT IN (
      SELECT t2.pedido_id FROM tracking t2 WHERE t2.etapa='empaque' AND t2.fecha_fin IS NOT NULL
    )
    AND p.id NOT IN (
      SELECT t3.pedido_id FROM tracking t3 WHERE t3.etapa='empaque' AND t3.fecha_salida IS NOT NULL AND t3.fecha_salida<>''
    )
    """)
    rows = c.fetchall()
    res=[]
    for r in rows:
        res.append({
            "numero":r["numero"],
            "fecha_registro":r["fecha_registro"],
            "hora_registro":r["hora_registro"]
        })
    return jsonify(res)

@app.route("/api/surtido/comenzar", methods=["POST"])
def surtido_comenzar():
    data = request.get_json()
    num = data.get("pedido_numero","").strip()
    if not num:
        return jsonify({"ok":False,"msg":"FALTA NÚMERO DE PEDIDO"})
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM pedidos WHERE numero=?",(num,))
    row = c.fetchone()
    if not row:
        return jsonify({"ok":False,"msg":f"NO EXISTE EL PEDIDO {num}"})
    pid = row["id"]

    c.execute("""SELECT id FROM tracking
                 WHERE pedido_id=? AND etapa='surtido' AND fecha_fin IS NULL""",(pid,))
    if c.fetchone():
        return jsonify({"ok":False,"msg":f"EL PEDIDO {num} YA TIENE UN SURTIDO EN PROGRESO."})

    ahora = datetime.now()
    fecha = ahora.strftime("%Y-%m-%d")
    hora = ahora.strftime("%H:%M:%S")
    usuario = session.get("user","DESCONOCIDO")
    c.execute("""INSERT INTO tracking (pedido_id, etapa, usuario, fecha_inicio, hora_inicio)
                 VALUES (?,?,?,?,?)""",(pid,"surtido",usuario,fecha,hora))
    db.commit()
    tracking_id = c.lastrowid
    return jsonify({"ok":True,"msg":f"SURTIDO COMENZADO PARA PEDIDO {num}","tracking_id":tracking_id})

@app.route("/api/surtido/finalizar", methods=["POST"])
def surtido_finalizar():
    data = request.get_json()
    tid = data.get("tracking_id")
    obs = data.get("observaciones","")
    if not tid:
        return jsonify({"ok":False,"msg":"FALTA TRACKING_ID"})

    db = get_db()
    c = db.cursor()
    c.execute("SELECT fecha_inicio, hora_inicio FROM tracking WHERE id=?",(tid,))
    row = c.fetchone()
    if not row:
        return jsonify({"ok":False,"msg":"NO SE ENCONTRÓ TRACKING SURTIDO"})

    ahora = datetime.now()
    ff = ahora.strftime("%Y-%m-%d")
    hf = ahora.strftime("%H:%M:%S")
    ini = datetime.strptime(row["fecha_inicio"]+" "+row["hora_inicio"], "%Y-%m-%d %H:%M:%S")
    fin = datetime.strptime(ff+" "+hf, "%Y-%m-%d %H:%M:%S")
    total = fin - ini

    c.execute("""UPDATE tracking
                 SET fecha_fin=?, hora_fin=?, total_tiempo=?, observaciones=?
                 WHERE id=?""",(ff,hf,str(total),obs,tid))
    db.commit()
    return jsonify({"ok":True,"msg":"SURTIDO FINALIZADO Y ENTREGADO A EMPAQUE"})

@app.route("/api/surtido/enprogreso")
def surtido_enprogreso():
    usuario = session.get("user","DESCONOCIDO")
    db = get_db()
    c = db.cursor()
    c.execute("""
    SELECT t.id as tracking_id, p.numero, t.fecha_inicio, t.hora_inicio, t.observaciones
    FROM tracking t
    JOIN pedidos p ON p.id=t.pedido_id
    WHERE t.etapa='surtido'
      AND t.fecha_fin IS NULL
      AND t.usuario=?
    """,(usuario,))
    rows = c.fetchall()
    res=[]
    for r in rows:
        res.append({
            "tracking_id":r["tracking_id"],
            "numero":r["numero"],
            "fecha_inicio":r["fecha_inicio"],
            "hora_inicio":r["hora_inicio"],
            "observaciones":r["observaciones"]
        })
    return jsonify(res)

@app.route("/api/surtido/reabrir", methods=["POST"])
def surtido_reabrir():
    data = request.get_json()
    tid = data.get("tracking_id")
    cancel = data.get("cancel", False)
    if not tid:
        return jsonify({"ok":False,"msg":"NO SE RECIBIÓ TRACKING_ID"})
    db = get_db()
    c = db.cursor()
    c.execute("SELECT pedido_id FROM tracking WHERE id=? AND etapa='surtido'",(tid,))
    row = c.fetchone()
    if not row:
        return jsonify({"ok":False,"msg":"NO SE ENCONTRÓ TRACKING SURTIDO"})

    if cancel:
        c.execute("DELETE FROM tracking WHERE id=?",(tid,))
        db.commit()
        return jsonify({"ok":True,"msg":"SURTIDO CANCELADO Y REABIERTO, PEDIDO QUEDA DISPONIBLE."})
    return jsonify({"ok":False,"msg":"FALTA cancel=true"})

# -------------------- EMPAQUE --------------------
@app.route("/api/empaque/disponibles")
def empaque_disponibles():
    db = get_db()
    c = db.cursor()
    c.execute("""
    SELECT p.numero, s.fecha_fin, s.hora_fin
    FROM pedidos p
    JOIN tracking s ON s.pedido_id=p.id
    WHERE s.etapa='surtido'
      AND s.fecha_fin IS NOT NULL
      AND p.id NOT IN (
        SELECT e.pedido_id FROM tracking e WHERE e.etapa='empaque' AND e.fecha_fin IS NOT NULL
      )
      AND p.id NOT IN (
        SELECT x.pedido_id FROM tracking x WHERE x.etapa='empaque' AND x.fecha_salida IS NOT NULL AND x.fecha_salida<>''
      )
    """)
    rows = c.fetchall()
    res=[]
    for r in rows:
        res.append({
            "numero":r["numero"],
            "fecha_fin":r["fecha_fin"],
            "hora_fin":r["hora_fin"]
        })
    return jsonify(res)

@app.route("/api/empaque/comenzar", methods=["POST"])
def empaque_comenzar():
    data = request.get_json()
    num = data.get("pedido_numero","").strip()
    if not num:
        return jsonify({"ok":False,"msg":"FALTA NÚMERO DE PEDIDO"})
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM pedidos WHERE numero=?",(num,))
    row = c.fetchone()
    if not row:
        return jsonify({"ok":False,"msg":f"NO EXISTE EL PEDIDO {num}"})
    pid = row["id"]

    c.execute("""SELECT id FROM tracking 
                 WHERE pedido_id=? 
                   AND etapa='empaque' 
                   AND fecha_fin IS NULL""",(pid,))
    if c.fetchone():
        return jsonify({"ok":False,"msg":f"EL PEDIDO {num} YA TIENE EMPAQUE EN PROGRESO."})

    ahora = datetime.now()
    f = ahora.strftime("%Y-%m-%d")
    h = ahora.strftime("%H:%M:%S")
    usuario = session.get("user","DESCONOCIDO")
    c.execute("""INSERT INTO tracking (pedido_id, etapa, usuario, fecha_inicio, hora_inicio)
                 VALUES (?,?,?,?,?)""",(pid,"empaque",usuario,f,h))
    db.commit()
    tracking_id = c.lastrowid
    return jsonify({"ok":True,"msg":f"EMPAQUE COMENZADO PARA PEDIDO {num}", "tracking_id": tracking_id})

@app.route("/api/empaque/finalizar", methods=["POST"])
def empaque_finalizar():
    data = request.get_json()
    tid = data.get("tracking_id")
    cajas = data.get("cajas",0)
    pallets = data.get("pallets",0)
    estatus = data.get("estatus","COMPLETO")
    obs = data.get("observaciones","")

    if not tid:
        return jsonify({"ok":False,"msg":"FALTA TRACKING_ID"})
    db = get_db()
    c = db.cursor()
    c.execute("SELECT fecha_inicio,hora_inicio FROM tracking WHERE id=?",(tid,))
    row = c.fetchone()
    if not row:
        return jsonify({"ok":False,"msg":"NO SE ENCONTRÓ TRACKING EMPAQUE"})

    ahora = datetime.now()
    ff = ahora.strftime("%Y-%m-%d")
    hf = ahora.strftime("%H:%M:%S")
    ini = datetime.strptime(row["fecha_inicio"]+" "+row["hora_inicio"], "%Y-%m-%d %H:%M:%S")
    fin = datetime.strptime(ff+" "+hf, "%Y-%m-%d %H:%M:%S")
    total = fin - ini

    c.execute("""UPDATE tracking
                 SET fecha_fin=?, hora_fin=?, total_tiempo=?,
                     cajas=?, pallets=?, estatus=?, observaciones=?
                 WHERE id=?""",
              (ff,hf,str(total),cajas,pallets,estatus,obs,tid))
    db.commit()
    return jsonify({"ok":True,"msg":"EMPAQUE FINALIZADO"})

@app.route("/api/empaque/enprogreso")
def empaque_enprogreso():
    usuario = session.get("user","DESCONOCIDO")
    db = get_db()
    c = db.cursor()
    c.execute("""
    SELECT t.id as tracking_id, p.numero, t.fecha_inicio, t.hora_inicio,
           t.cajas, t.pallets, t.estatus, t.observaciones
    FROM tracking t
    JOIN pedidos p ON p.id=t.pedido_id
    WHERE t.etapa='empaque'
      AND t.fecha_fin IS NULL
      AND t.usuario=?
    """,(usuario,))
    rows = c.fetchall()
    res=[]
    for r in rows:
        res.append({
            "tracking_id":r["tracking_id"],
            "numero":r["numero"],
            "fecha_inicio":r["fecha_inicio"],
            "hora_inicio":r["hora_inicio"],
            "cajas":r["cajas"],
            "pallets":r["pallets"],
            "estatus":r["estatus"],
            "observaciones":r["observaciones"]
        })
    return jsonify(res)

@app.route("/api/empaque/reabrir", methods=["POST"])
def empaque_reabrir():
    data = request.get_json()
    tid = data.get("tracking_id")
    cancel = data.get("cancel", False)
    if not tid:
        return jsonify({"ok":False,"msg":"NO SE RECIBIÓ TRACKING_ID"})
    db = get_db()
    c = db.cursor()
    c.execute("SELECT pedido_id FROM tracking WHERE id=? AND etapa='empaque'",(tid,))
    row = c.fetchone()
    if not row:
        return jsonify({"ok":False,"msg":"NO SE ENCONTRÓ TRACKING EMPAQUE"})

    if cancel:
        c.execute("DELETE FROM tracking WHERE id=?",(tid,))
        db.commit()
        return jsonify({"ok":True,"msg":"EMPAQUE CANCELADO Y REABIERTO, PEDIDO QUEDA DISPONIBLE."})
    return jsonify({"ok":False,"msg":"FALTA cancel=true"})

# -------------------- EMBARQUE --------------------
@app.route("/api/embarque/disponibles")
def embarque_disponibles():
    db = get_db()
    c = db.cursor()
    c.execute("""
    SELECT e.id as tracking_id, p.numero, e.fecha_fin, e.hora_fin,
           e.cajas, e.pallets, e.estatus, e.observaciones,
           e.tipo_salida, e.fecha_salida, e.hora_salida
    FROM pedidos p
    JOIN tracking e ON e.pedido_id=p.id
    WHERE e.etapa='empaque'
      AND e.fecha_fin IS NOT NULL
      AND (e.fecha_salida IS NULL OR e.fecha_salida='' OR e.tipo_salida='local-pendiente')
    """)
    rows = c.fetchall()
    res=[]
    for r in rows:
        res.append({
            "tracking_id":r["tracking_id"],
            "numero":r["numero"],
            "fecha_fin":r["fecha_fin"],
            "hora_fin":r["hora_fin"],
            "cajas":r["cajas"],
            "pallets":r["pallets"],
            "estatus":r["estatus"],
            "observaciones":r["observaciones"],
            "tipo_salida":r["tipo_salida"] or ""
        })
    return jsonify(res)

@app.route("/api/embarque/confirmar", methods=["POST"])
def embarque_confirmar():
    data = request.get_json()
    tid = data.get("tracking_id")
    tipo_salida = data.get("tipo_salida","").lower()
    obs_sal = data.get("observaciones_salida","")
    fecha_cita = data.get("fecha_cita","")

    if not tid:
        return jsonify({"ok":False,"msg":"FALTA TRACKING_ID"})

    db = get_db()
    c = db.cursor()
    ahora = datetime.now()
    fs = ahora.strftime("%Y-%m-%d")
    hs = ahora.strftime("%H:%M:%S")

    if tipo_salida=="local":
        c.execute("""
        UPDATE tracking
        SET tipo_salida='local-pendiente', observaciones_salida=?
        WHERE id=?""",(f"FECHA CITA: {fecha_cita}. {obs_sal}",tid))
        db.commit()
        return jsonify({"ok":True,"msg":"PEDIDO LOCAL MARCADO COMO PENDIENTE. FALTA CONFIRMAR ENTREGA."})
    else:
        c.execute("""
        UPDATE tracking
        SET tipo_salida=?, fecha_salida=?, hora_salida=?, observaciones_salida=?
        WHERE id=?""",(tipo_salida,fs,hs,obs_sal,tid))
        db.commit()
        return jsonify({"ok":True,"msg":f"SALIDA CONFIRMADA ({tipo_salida})."})

@app.route("/api/embarque/entrega_local", methods=["POST"])
def embarque_entrega_local():
    data = request.get_json()
    tid = data.get("tracking_id")
    obs_ent = data.get("observaciones_entrega","")
    if not tid:
        return jsonify({"ok":False,"msg":"FALTA TRACKING_ID"})

    ahora = datetime.now()
    fs = ahora.strftime("%Y-%m-%d")
    hs = ahora.strftime("%H:%M:%S")

    db = get_db()
    c = db.cursor()
    c.execute("""
    UPDATE tracking
    SET tipo_salida='local', fecha_salida=?, hora_salida=?, observaciones_salida=?
    WHERE id=? AND tipo_salida='local-pendiente'
    """,(fs,hs,obs_ent,tid))
    db.commit()
    return jsonify({"ok":True,"msg":"ENTREGA LOCAL CONFIRMADA. SALIDA FINALIZADA."})

# -------------------- REPORTES --------------------
@app.route("/api/reportes")
def reportes():
    pedido = request.args.get("pedido","").strip()
    f_ini = request.args.get("fecha_ini","")
    f_fin = request.args.get("fecha_fin","")
    usuario_f = request.args.get("usuario","").strip()
    db = get_db()
    c = db.cursor()
    c.execute("""
    SELECT p.numero as pedido,
           p.usuario_registro as impresion_user,
           p.fecha_registro||' '||p.hora_registro as impresion_fecha,
           s.usuario as surtidor,
           CASE WHEN s.fecha_inicio IS NULL THEN '' ELSE s.fecha_inicio||' '||s.hora_inicio END as surtido_inicio,
           CASE WHEN s.fecha_fin IS NULL THEN '' ELSE s.fecha_fin||' '||s.hora_fin END as surtido_fin,
           s.total_tiempo as surtido_tiempo,
           s.observaciones as surtido_observ,
           e.usuario as empaque_user,
           CASE WHEN e.fecha_inicio IS NULL THEN '' ELSE e.fecha_inicio||' '||e.hora_inicio END as empaque_inicio,
           CASE WHEN e.fecha_fin IS NULL THEN '' ELSE e.fecha_fin||' '||e.hora_fin END as empaque_fin,
           e.total_tiempo as empaque_tiempo,
           e.cajas as empaque_cajas,
           e.pallets as empaque_pallets,
           e.estatus as empaque_estatus,
           e.observaciones as empaque_observ,
           CASE WHEN x.fecha_salida IS NULL THEN '' ELSE x.fecha_salida||' '||x.hora_salida END as salida_fecha,
           x.tipo_salida as salida_tipo,
           x.observaciones_salida as salida_observ
    FROM pedidos p
    LEFT JOIN tracking s ON (s.pedido_id=p.id AND s.etapa='surtido')
    LEFT JOIN tracking e ON (e.pedido_id=p.id AND e.etapa='empaque')
    LEFT JOIN tracking x ON (x.pedido_id=p.id AND x.etapa='empaque' AND x.fecha_salida IS NOT NULL)
    GROUP BY p.id
    ORDER BY p.id DESC
    """)
    rows = c.fetchall()
    res=[]
    for r in rows:
        # Filtro por pedido
        if pedido and pedido.lower() not in r["pedido"].lower():
            continue
        # Filtro por usuario
        if usuario_f:
            surtid = (r["surtidor"] or "").lower()
            empac = (r["empaque_user"] or "").lower()
            if usuario_f.lower() not in surtid and usuario_f.lower() not in empac:
                continue
        fe_imp = None
        try:
            fe_imp = datetime.strptime(r["impresion_fecha"], "%Y-%m-%d %H:%M:%S")
        except:
            pass
        # Filtro fecha_ini
        if f_ini:
            try:
                fi_dt = datetime.strptime(f_ini, "%Y-%m-%d")
                if fe_imp and fe_imp < fi_dt:
                    continue
            except:
                pass
        # Filtro fecha_fin
        if f_fin:
            try:
                ff_dt = datetime.strptime(f_fin, "%Y-%m-%d")
                ff_limit = datetime(ff_dt.year, ff_dt.month, ff_dt.day, 23, 59, 59)
                if fe_imp and fe_imp > ff_limit:
                    continue
            except:
                pass

        # Calculo del tiempo total
        ttotal = ""
        if r["salida_fecha"]:
            try:
                f_imp2 = datetime.strptime(r["impresion_fecha"], "%Y-%m-%d %H:%M:%S")
                f_sal = datetime.strptime(r["salida_fecha"], "%Y-%m-%d %H:%M:%S")
                diff = f_sal - f_imp2
                d = diff.days
                secs = diff.seconds
                hh = secs // 3600
                mm = (secs % 3600)//60
                ttotal = f"{d}D {hh}H {mm}M"
            except:
                pass

        res.append({
            "pedido": r["pedido"],
            "impresion_fecha": r["impresion_fecha"],
            "surtidor": r["surtidor"] or "",
            "surtido_inicio": r["surtido_inicio"],
            "surtido_fin": r["surtido_fin"],
            "surtido_tiempo": r["surtido_tiempo"] or "",
            "surtido_observ": r["surtido_observ"] or "",
            "empaque_user": r["empaque_user"] or "",
            "empaque_inicio": r["empaque_inicio"],
            "empaque_fin": r["empaque_fin"],
            "empaque_tiempo": r["empaque_tiempo"] or "",
            "empaque_cajas": r["empaque_cajas"] if r["empaque_cajas"] else 0,
            "empaque_pallets": r["empaque_pallets"] if r["empaque_pallets"] else 0,
            "empaque_estatus": r["empaque_estatus"] or "",
            "empaque_observ": r["empaque_observ"] or "",
            "empaque_incidencias": "0",
            "salida_fecha": r["salida_fecha"] or "",
            "salida_tipo": r["salida_tipo"] or "",
            "salida_observ": r["salida_observ"] or "",
            "tiempo_total": ttotal
        })
    return jsonify(res)

# -------------------- DASHBOARD --------------------
@app.route("/api/dashboard")
def api_dashboard():
    db = get_db()
    c = db.cursor()

    c.execute("SELECT COUNT(*) as total FROM pedidos")
    total_pedidos = c.fetchone()["total"]

    # Pendientes surtir
    c.execute("""
    SELECT COUNT(*) as total
    FROM pedidos
    WHERE id NOT IN (
      SELECT pedido_id FROM tracking WHERE etapa='surtido'
    )
    """)
    pendientes_surtir = c.fetchone()["total"]

    # Pendientes empaque
    c.execute("""
    SELECT COUNT(*) as total
    FROM pedidos p
    JOIN tracking s ON s.pedido_id=p.id AND s.etapa='surtido' AND s.fecha_fin IS NOT NULL
    WHERE p.id NOT IN(
      SELECT pedido_id FROM tracking WHERE etapa='empaque'
    )
    """)
    pendientes_empaque = c.fetchone()["total"]

    # Pendientes embarcar
    c.execute("""
    SELECT COUNT(*) as total
    FROM pedidos p
    JOIN tracking e ON e.pedido_id=p.id AND e.etapa='empaque' AND e.fecha_fin IS NOT NULL
    WHERE (e.fecha_salida IS NULL OR e.fecha_salida='' OR e.tipo_salida='local-pendiente')
    """)
    pendientes_embarcar = c.fetchone()["total"]

    # SURTIDORES
    c.execute("""
    SELECT 
        s.usuario,
        COUNT(s.id) AS surtidos,
        IFNULL(SUM(
            CASE
              WHEN e.estatus='INCIDENCIA' THEN 1
              ELSE 0
            END
        ), 0) AS incidencias,
        IFNULL(SUM(
            (julianday(s.fecha_fin || ' ' || s.hora_fin) - 
             julianday(s.fecha_inicio || ' ' || s.hora_inicio)
            ) * 24 * 3600
        ), 0) AS sum_surtido_seconds,
        u.foto AS foto
    FROM tracking s
    JOIN pedidos p ON s.pedido_id=p.id
    LEFT JOIN usuarios u ON u.nombre=s.usuario
    LEFT JOIN tracking e ON (e.pedido_id=p.id AND e.etapa='empaque')
    WHERE s.etapa='surtido' 
          AND s.fecha_fin IS NOT NULL
    GROUP BY s.usuario
    """)
    surt_rows = c.fetchall()
    surtidores = []
    for row in surt_rows:
        surtidos_count = row["surtidos"]
        sum_surtido_seconds = row["sum_surtido_seconds"] or 0
        avg_sec = 0
        if surtidos_count > 0:
            avg_sec = sum_surtido_seconds / surtidos_count
        hh = int(avg_sec // 3600)
        mm = int((avg_sec % 3600) // 60)
        tiempo_promedio = f"{hh}h {mm}m"

        surtidores.append({
            "usuario": row["usuario"],
            "cantidad": surtidos_count,
            "incidencias": row["incidencias"],
            "tiempo_promedio": tiempo_promedio,
            "foto": row["foto"] if row["foto"] else ""
        })

    # EMPACADORES
    c.execute("""
    SELECT 
      e.usuario,
      COUNT(e.id) as empacados,
      IFNULL(SUM(e.cajas), 0) as sum_cajas,
      IFNULL(SUM(e.pallets), 0) as sum_pallets,
      IFNULL(SUM(
          (julianday(e.fecha_fin || ' ' || e.hora_fin) - 
           julianday(e.fecha_inicio || ' ' || e.hora_inicio)
          ) * 24 * 3600
      ), 0) AS sum_empaque_seconds,
      u.foto as foto
    FROM tracking e
    JOIN pedidos p ON e.pedido_id=p.id
    LEFT JOIN usuarios u ON u.nombre=e.usuario
    WHERE e.etapa='empaque' 
          AND e.fecha_fin IS NOT NULL
    GROUP BY e.usuario
    """)
    emp_rows = c.fetchall()
    empacadores = []
    for row in emp_rows:
        empacados_count = row["empacados"]
        sum_empaque_seconds = row["sum_empaque_seconds"] or 0
        avg_sec = 0
        if empacados_count > 0:
            avg_sec = sum_empaque_seconds / empacados_count
        hh = int(avg_sec // 3600)
        mm = int((avg_sec % 3600) // 60)
        tiempo_promedio = f"{hh}h {mm}m"

        empacadores.append({
            "usuario": row["usuario"],
            "cantidad": empacados_count,
            "sum_cajas": row["sum_cajas"],
            "sum_pallets": row["sum_pallets"],
            "tiempo_promedio": tiempo_promedio,
            "foto": row["foto"] if row["foto"] else ""
        })

    # Cálculo de tiempo promedio global y % de cumplimiento
    c.execute("""
    SELECT p.id, p.fecha_registro, p.hora_registro,
           x.fecha_salida, x.hora_salida
    FROM pedidos p
    JOIN tracking x ON x.pedido_id=p.id 
                    AND x.etapa='empaque' 
                    AND x.fecha_salida IS NOT NULL
    """)
    rows = c.fetchall()
    total_count = 0
    sum_seconds = 0
    cumplidos = 0
    for r in rows:
        total_count+=1
        f_reg = datetime.strptime(r["fecha_registro"]+" "+r["hora_registro"],"%Y-%m-%d %H:%M:%S")
        f_sal = datetime.strptime(r["fecha_salida"]+" "+r["hora_salida"],"%Y-%m-%d %H:%M:%S")
        diff = f_sal - f_reg
        sum_seconds += diff.total_seconds()
        if diff.total_seconds()<=86400:
            cumplidos+=1
    tiempo_promedio_global="0D 0H 0M"
    cumplimiento_porcentaje=100
    if total_count>0:
        avg = sum_seconds/total_count
        d = int(avg//86400)
        resto = avg%86400
        h = int(resto//3600)
        m = int((resto%3600)//60)
        tiempo_promedio_global=f"{d}D {h}H {m}M"
        cumplimiento_porcentaje=round((cumplidos/total_count)*100,1)

    return jsonify({
        "total_pedidos": total_pedidos,
        "pendientes_surtir": pendientes_surtir,
        "pendientes_empaque": pendientes_empaque,
        "pendientes_embarcar": pendientes_embarcar,
        "surtidores": surtidores,
        "empacadores": empacadores,
        "tiempo_promedio_global": tiempo_promedio_global,
        "cumplimiento_porcentaje": cumplimiento_porcentaje
    })

# -------------------- ADMIN DB --------------------
@app.route("/api/admin_db/tables")
def admin_db_tables():
    if session.get("tipo") != "master":
        return jsonify({"ok": False, "tables": [], "msg": "NO TIENES PERMISO"}), 403

    db = get_db()
    c = db.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    rows = c.fetchall()
    tables = []
    for r in rows:
        tname = r["name"]
        if tname.lower() not in ["sqlite_sequence"]:
            tables.append(tname)
    return jsonify({"ok": True, "tables": tables})

@app.route("/api/admin_db/get_table")
def admin_db_get_table():
    if session.get("tipo") != "master":
        return jsonify({"ok":False,"msg":"NO TIENES PERMISO"}), 403

    nombre_tabla = request.args.get("tabla", "").strip()
    if not nombre_tabla:
        return jsonify({"ok":False,"msg":"FALTA PARAMETRO tabla"})

    db = get_db()
    c = db.cursor()
    try:
        c.execute(f"SELECT * FROM '{nombre_tabla}'")
        rows = c.fetchall()
        dict_rows = []
        for r in rows:
            dict_rows.append(dict(r))
        return jsonify({"ok":True,"rows":dict_rows})
    except Exception as e:
        return jsonify({"ok":False,"msg":str(e)})

@app.route("/api/admin_db/edit_row", methods=["POST"])
def admin_db_edit_row():
    if session.get("tipo") != "master":
        return jsonify({"ok":False,"msg":"NO TIENES PERMISO"}),403

    data = request.get_json()
    table = data.get("table","").strip()
    row_id = data.get("row_id")
    updated_data = data.get("updates", {})

    if not table or row_id is None:
        return jsonify({"ok":False,"msg":"Faltan parámetros (table o row_id)."})
    try:
        db = get_db()
        c = db.cursor()
        set_parts = []
        values = []
        for col, val in updated_data.items():
            set_parts.append(f"\"{col}\"=?")
            values.append(val)
        set_clause = ", ".join(set_parts)
        sql = f"UPDATE \"{table}\" SET {set_clause} WHERE id=?"
        values.append(row_id)
        c.execute(sql, values)
        db.commit()
        return jsonify({"ok":True,"msg":f"Fila {row_id} de '{table}' actualizada correctamente."})
    except Exception as e:
        return jsonify({"ok":False,"msg":str(e)})

@app.route("/api/admin_db/delete_row", methods=["POST"])
def admin_db_delete_row():
    if session.get("tipo") != "master":
        return jsonify({"ok":False,"msg":"NO TIENES PERMISO"}),403

    data = request.get_json()
    table = data.get("table","").strip()
    row_id = data.get("row_id")

    if not table or row_id is None:
        return jsonify({"ok":False,"msg":"Faltan parámetros (table o row_id)."})
    try:
        db = get_db()
        c = db.cursor()
        sql = f"DELETE FROM \"{table}\" WHERE id=?"
        c.execute(sql, (row_id,))
        db.commit()
        return jsonify({"ok":True,"msg":f"Fila {row_id} de '{table}' eliminada correctamente."})
    except Exception as e:
        return jsonify({"ok":False,"msg":str(e)})

# -------------------- CONFIGURACIÓN USUARIOS --------------------
@app.route("/api/config/crear_usuario", methods=["POST"])
def config_crear_usuario():
    if session.get("tipo")!="master":
        return jsonify({"ok":False,"msg":"NO TIENES PERMISO PARA CREAR USUARIOS"})
    nombre = request.form.get("nombre","").strip()
    password = request.form.get("password","").strip()
    tipo = request.form.get("tipo","").strip()
    accesos_str = request.form.get("accesos","[]")
    file = request.files.get("foto", None)
    if not (nombre and password and tipo):
        return jsonify({"ok":False,"msg":"DATOS INCOMPLETOS"})

    db = get_db()
    c = db.cursor()
    c.execute("SELECT * FROM usuarios WHERE nombre=?",(nombre,))
    if c.fetchone():
        return jsonify({"ok":False,"msg":"EL USUARIO YA EXISTE"})

    foto_filename=""
    if file and allowed_file(file.filename):
        secure_name = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, secure_name))
        foto_filename = secure_name

    c.execute("INSERT INTO usuarios (nombre,password,tipo,foto,accesos) VALUES (?,?,?,?,?)",
              (nombre,password,tipo,foto_filename,accesos_str))
    db.commit()
    return jsonify({"ok":True,"msg":"USUARIO CREADO."})

@app.route("/api/config/eliminar_usuario", methods=["POST"])
def config_eliminar_usuario():
    if session.get("tipo")!="master":
        return jsonify({"ok":False,"msg":"NO TIENES PERMISO PARA ELIMINAR USUARIOS"})
    data = request.get_json()
    uid = data.get("user_id")
    db = get_db()
    c = db.cursor()
    c.execute("DELETE FROM usuarios WHERE id=?",(uid,))
    db.commit()
    return jsonify({"ok":True,"msg":"USUARIO ELIMINADO."})

@app.route("/api/config/editar_usuario", methods=["POST"])
def config_editar_usuario():
    if session.get("tipo")!="master":
        return jsonify({"ok":False,"msg":"NO TIENES PERMISO PARA EDITAR USUARIOS"})
    user_id = request.form.get("user_id")
    nombre = request.form.get("nombre","").strip()
    password = request.form.get("password","").strip()
    tipo = request.form.get("tipo","").strip()
    accesos_str = request.form.get("accesos","[]")
    file = request.files.get("foto", None)
    if not user_id or not nombre or not tipo:
        return jsonify({"ok":False,"msg":"DATOS INSUFICIENTES PARA EDITAR"})

    db = get_db()
    c = db.cursor()
    c.execute("SELECT id FROM usuarios WHERE nombre=? AND id<>?",(nombre,user_id))
    row = c.fetchone()
    if row:
        return jsonify({"ok":False,"msg":"YA EXISTE OTRO USUARIO CON ESE NOMBRE."})

    foto_filename=None
    if file and allowed_file(file.filename):
        secure_name = secure_filename(file.filename)
        file.save(os.path.join(UPLOAD_FOLDER, secure_name))
        foto_filename = secure_name

    if password:
        if foto_filename is not None:
            c.execute("UPDATE usuarios SET nombre=?, password=?, tipo=?, foto=?, accesos=? WHERE id=?",
                      (nombre,password,tipo,foto_filename,accesos_str,user_id))
        else:
            c.execute("UPDATE usuarios SET nombre=?, password=?, tipo=?, accesos=? WHERE id=?",
                      (nombre,password,tipo,accesos_str,user_id))
    else:
        if foto_filename is not None:
            c.execute("UPDATE usuarios SET nombre=?, tipo=?, foto=?, accesos=? WHERE id=?",
                      (nombre,tipo,foto_filename,accesos_str,user_id))
        else:
            c.execute("UPDATE usuarios SET nombre=?, tipo=?, accesos=? WHERE id=?",
                      (nombre,tipo,accesos_str,user_id))

    db.commit()
    return jsonify({"ok":True,"msg":"USUARIO ACTUALIZADO EXITOSAMENTE."})

@app.route("/api/config/usuarios")
def config_usuarios():
    if session.get("tipo")!="master":
        return jsonify([])
    db = get_db()
    c = db.cursor()
    c.execute("SELECT id,nombre,tipo,foto,accesos FROM usuarios ORDER BY id")
    rows = c.fetchall()
    res=[]
    for r in rows:
        res.append({
            "id":r["id"],
            "nombre":r["nombre"],
            "tipo":r["tipo"],
            "foto":r["foto"] or "",
            "accesos":r["accesos"] or "[]"
        })
    return jsonify(res)

@app.route("/api/config/download_db")
def download_db():
    if session.get("tipo")!="master":
        return "NO TIENES PERMISO",403
    db_path = os.path.join(os.getcwd(), DATABASE)
    if not os.path.exists(db_path):
        return "DB NOT FOUND",404
    return send_file(db_path, as_attachment=True, download_name="db.db")

if __name__=="__main__":
    init_db()
    app.run(host="192.168.1.221", port=5001, debug=True)
