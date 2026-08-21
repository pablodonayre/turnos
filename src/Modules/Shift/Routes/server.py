import sys
import time
import threading
import os
import zlib
from datetime import datetime
from zoneinfo import ZoneInfo

from flask import Flask, request, jsonify, send_from_directory, abort
from PyQt6.QtWidgets import (
    QApplication,
    QMainWindow,
    QLabel,
    QVBoxLayout,
    QHBoxLayout,
    QWidget,
    QTextEdit,
    QPushButton,
    QSpinBox,
)
from PyQt6.QtCore import QThread, pyqtSignal
from PyQt6.QtGui import QFont


# ============================================================
# CONFIGURACIÓN GENERAL
# ============================================================

HOST = "0.0.0.0"
PORT = 5000

FIRMWARE_DIR = os.path.join(os.getcwd(), "firmware")
os.makedirs(FIRMWARE_DIR, exist_ok=True)

# OTA: versión 17 se presenta como 0.17.
OTA_VERSION = 18
OTA_FILENAME = "AsistenciaESP32.bin"

app = Flask(__name__)

def log_endpoint_timing(nombre, inicio, extra=""):
    duracion_ms = (time.perf_counter() - inicio) * 1000.0
    sufijo = f" | {extra}" if extra else ""
    print(f"[SERVER {nombre}] {duracion_ms:.2f} ms{sufijo}")


contador_peticiones_http = 0
lock_contador_http = threading.Lock()
eventos_procesados = set()
lock_eventos = threading.Lock()

@app.before_request
def iniciar_medicion_peticion():
    global contador_peticiones_http
    with lock_contador_http:
        contador_peticiones_http += 1
        request._id_http = contador_peticiones_http

    request._inicio_perf = time.perf_counter()
    query = request.query_string.decode("utf-8", errors="replace")
    destino = request.path + (f"?{query}" if query else "")
    print(
        f"[HTTP SERVER #{request._id_http}] "
        f"INICIO {request.method} {destino} desde {request.remote_addr}"
    )


@app.after_request
def registrar_duracion_peticion(response):
    inicio = getattr(request, "_inicio_perf", None)
    id_http = getattr(request, "_id_http", "?")
    if inicio is not None:
        duracion_ms = (time.perf_counter() - inicio) * 1000.0
        print(
            f"[HTTP SERVER #{id_http}] "
            f"FIN {request.method} {request.path} "
            f"-> {response.status_code} en {duracion_ms:.1f} ms"
        )

    response.headers["X-Request-ID"] = str(id_http)
    return response

modo_dispositivo = None
modo_deseado = None
test_interval_ms = 3000

def obtener_modo_dispositivo():
    return (
        modo_dispositivo
        if modo_dispositivo is not None
        else "DESCONOCIDO"
    )



# ============================================================
# BASE DE DATOS SIMULADA
# ============================================================

USUARIOS_AUTORIZADOS = {
    "8B AE 26 0A": "Juan Carlos Agüero Flores",
    "21 0C 83 2F": "Jimmy Andrade (Ing. Aeronautico)",
    "FF FF FF FF": "Tarjeta de Prueba",
}

USUARIOS_BLOQUEADOS = set()
VERSION_USUARIOS = 5


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def normalizar_uid(uid):
    """
    Convierte el UID recibido a un formato uniforme:
    '8b ae 26 0a' -> '8B AE 26 0A'
    """
    if not isinstance(uid, str):
        return ""

    partes = uid.strip().replace("-", " ").replace(":", " ").split()

    uid_normalizado = []

    for parte in partes:
        try:
            valor = int(parte, 16)
        except ValueError:
            return ""

        if valor < 0 or valor > 255:
            return ""

        uid_normalizado.append(f"{valor:02X}")

    return " ".join(uid_normalizado)


def convertir_timestamp(timestamp):
    """
    Convierte un UNIX timestamp (instante absoluto UTC)
    a fecha/hora local de Lima, Perú.
    """
    try:
        valor = int(timestamp)

        if valor <= 0:
            return "N/A"

        fecha_lima = datetime.fromtimestamp(
            valor,
            tz=ZoneInfo("America/Lima"),
        )

        return fecha_lima.strftime("%d/%m/%Y %H:%M:%S")

    except (TypeError, ValueError, OSError, OverflowError):
        return "N/A"



def limpiar_campo_csv(valor):
    texto = str(valor)
    return texto.replace(",", " ").replace("\r", " ").replace("\n", " ")


def construir_lista_usuarios():
    usuarios = []

    for uid, nombre in USUARIOS_AUTORIZADOS.items():
        usuarios.append({
            "uid": uid,
            "nombre": nombre,
            "habilitado": uid not in USUARIOS_BLOQUEADOS,
            "reservado1": "",
            "reservado2": "",
            "reservado3": "",
        })

    return usuarios


def construir_csv_usuarios(usuarios):
    lineas = [
        "uid,nombre,habilitado,reservado1,reservado2,reservado3"
    ]

    for usuario in usuarios:
        uid = limpiar_campo_csv(usuario["uid"])
        nombre = limpiar_campo_csv(usuario["nombre"])
        habilitado = "1" if usuario["habilitado"] else "0"

        lineas.append(
            f"{uid},{nombre},{habilitado},,,"
        )

    # IMPORTANTE:
    # Arduino Print::println() escribe CRLF (\r\n).
    # El CRC del servidor debe calcularse sobre exactamente los mismos
    # bytes que el ESP32 termina guardando en users.csv.
    return "\r\n".join(lineas) + "\r\n"


def calcular_crc32_usuarios(usuarios):
    contenido = construir_csv_usuarios(usuarios).encode("utf-8")
    return zlib.crc32(contenido) & 0xFFFFFFFF


# ============================================================
# HILO DEL SERVIDOR FLASK
# ============================================================

class FlaskThread(QThread):
    data_received = pyqtSignal(dict)
    server_message = pyqtSignal(str)
    state_received = pyqtSignal(str)

    def run(self):

        @app.route("/rfid", methods=["POST"])
        def rfid_endpoint():
            global modo_dispositivo, modo_deseado

            if not request.is_json:
                return jsonify({
                    "status": "error",
                    "message": "Se esperaba Content-Type application/json",
                }), 400

            data = request.get_json(silent=True)

            if not isinstance(data, dict):
                return jsonify({
                    "status": "error",
                    "message": "JSON inválido",
                }), 400

            uid = normalizar_uid(data.get("uid", ""))
            accion = str(data.get("accion", "")).strip().upper()
            timestamp = data.get("timestamp", 0)
            dispositivo = str(
                data.get("dispositivo", "ESP32")
            ).strip()

            es_test = bool(data.get("test", False))
            modo_operacion = obtener_modo_dispositivo()

            clave_evento = (
                dispositivo,
                uid,
                accion,
                str(timestamp),
            )

            with lock_eventos:
                evento_duplicado = clave_evento in eventos_procesados
                if not evento_duplicado:
                    eventos_procesados.add(clave_evento)

                if len(eventos_procesados) > 5000:
                    eventos_procesados.clear()
                    eventos_procesados.add(clave_evento)

            if not uid:
                return jsonify({
                    "status": "error",
                    "message": "UID ausente o inválido",
                }), 400

            if accion not in ("ENTRADA", "SALIDA", "REGISTRO"):
                return jsonify({
                    "status": "error",
                    "message": "La acción debe ser ENTRADA, SALIDA o REGISTRO",
                }), 400

            habilitado = False
            usuario_nombre = "Desconocido"
            detalle_resultado = "NO_REGISTRADO"

            # --------------------------------------------------------
            # MODO REGISTRO
            # --------------------------------------------------------
            # La acción REGISTRO tiene semántica propia.
            #
            # Es importante evaluarla antes que modo_operacion porque un
            # registro capturado OFFLINE puede llegar posteriormente desde
            # queue.ndjson cuando el servidor ya haya vuelto a ASISTENCIA.
            #
            # En REGISTRO ONLINE el servidor es la autoridad para indicar si
            # el UID ya existe o si es nuevo.
            if accion == "REGISTRO":
                if uid in USUARIOS_AUTORIZADOS:
                    usuario_nombre = USUARIOS_AUTORIZADOS[uid]
                    habilitado = uid not in USUARIOS_BLOQUEADOS
                    detalle_resultado = "UID_YA_EXISTE"

                    print(
                        "[REGISTRO] UID YA EXISTE: "
                        f"{uid} -> {usuario_nombre}"
                    )
                else:
                    usuario_nombre = "NUEVO UID"
                    habilitado = False
                    detalle_resultado = "UID_NUEVO"

                    print(
                        "[REGISTRO] UID NUEVO: "
                        f"{uid}"
                    )

            # --------------------------------------------------------
            # MODO ASISTENCIA NORMAL
            # --------------------------------------------------------
            elif modo_operacion == "BLOQUEADO":
                habilitado = False
                usuario_nombre = "SISTEMA BLOQUEADO"
                detalle_resultado = "SISTEMA_BLOQUEADO"

            else:
                if uid in USUARIOS_AUTORIZADOS:
                    usuario_nombre = USUARIOS_AUTORIZADOS[uid]

                    if uid in USUARIOS_BLOQUEADOS:
                        habilitado = False
                        detalle_resultado = "DESHABILITADO"
                    else:
                        habilitado = True
                        detalle_resultado = "HABILITADO"

            evento_gui = {
                "uid": uid,
                "accion": accion,
                "timestamp": timestamp,
                "timestamp_legible": convertir_timestamp(timestamp),
                "dispositivo": dispositivo,
                "habilitado": habilitado,
                "detalleDelResultado": detalle_resultado,
                "usuario": usuario_nombre,
                "modo_operado": modo_operacion,
                "test": es_test,
            }

            if not evento_duplicado:
                self.data_received.emit(evento_gui)
            else:
                print(
                    "[RFID] Duplicado confirmado sin repetirlo en GUI: "
                    f"{uid} {accion} {timestamp}"
                )

            return jsonify({
                "habilitado": habilitado,
                "detalleDelResultado": detalle_resultado,
                "usuario": usuario_nombre,
                "modo": modo_operacion,
                "duplicado": evento_duplicado,
            }), 200

        @app.route("/ordenes", methods=["GET"])
        def enviar_ordenes():
            global modo_dispositivo, modo_deseado, test_interval_ms

            inicio_endpoint = time.perf_counter()

            respuesta = {
                "solicitar_estado": modo_dispositivo is None,
                "cambiar_modo": modo_deseado is not None,
                "modo": modo_deseado,
                "test_interval_ms": test_interval_ms,
            }

            log_endpoint_timing(
                "ORDENES",
                inicio_endpoint,
                f"cambiar_modo={respuesta['cambiar_modo']}",
            )

            return jsonify(respuesta), 200

        @app.route("/estado", methods=["POST"])
        def recibir_estado():
            global modo_dispositivo, modo_deseado

            inicio_endpoint = time.perf_counter()

            if not request.is_json:
                return jsonify({
                    "ok": False,
                    "message": "Se esperaba JSON",
                }), 400

            data = request.get_json(silent=True)

            if not isinstance(data, dict):
                return jsonify({
                    "ok": False,
                    "message": "JSON inválido",
                }), 400

            dispositivo = str(
                data.get("dispositivo", "ESP32")
            ).strip()

            modo_actual = str(
                data.get("modo_actual", "")
            ).strip().upper()

            firmware_version = str(
                data.get("firmware_version", "")
            ).strip()

            if modo_actual not in (
                "ASISTENCIA",
                "BLOQUEADO",
                "REGISTRO",
                "TEST",
            ):
                return jsonify({
                    "ok": False,
                    "message": "modo_actual inválido",
                }), 400

            modo_anterior = modo_dispositivo
            modo_dispositivo = modo_actual

            if modo_deseado == modo_actual:
                modo_deseado = None

            print(
                "[ESTADO] "
                f"{dispositivo} -> modo={modo_actual} "
                f"firmware={firmware_version or 'N/A'}"
            )

            self.state_received.emit(modo_actual)

            if modo_anterior != modo_actual:
                self.server_message.emit(
                    f"[ESTADO] Modo real del dispositivo: {modo_actual}"
                )

            respuesta = {
                "ok": True,
                "modo_recibido": modo_actual,
                "orden_pendiente": modo_deseado,
            }

            log_endpoint_timing(
                "ESTADO",
                inicio_endpoint,
                f"modo={modo_actual}",
            )

            return jsonify(respuesta), 200

        @app.route("/usuarios", methods=["GET"])
        def enviar_usuarios():
            version_cliente = request.args.get(
                "version",
                default=0,
                type=int,
            )

            usuarios = construir_lista_usuarios()
            crc32 = calcular_crc32_usuarios(usuarios)

            if version_cliente == VERSION_USUARIOS:
                return jsonify({
                    "status": "up_to_date",
                    "version": VERSION_USUARIOS,
                    "crc32": crc32,
                }), 200

            return jsonify({
                "status": "update",
                "version": VERSION_USUARIOS,
                "crc32": crc32,
                "usuarios": usuarios,
            }), 200

        @app.route("/check-version", methods=["GET"])
        def check_version():
            inicio_endpoint = time.perf_counter()

            try:
                version_cliente = int(
                    request.args.get("version", "0")
                )
            except ValueError:
                version_cliente = 0

            ruta_bin = os.path.join(
                FIRMWARE_DIR,
                OTA_FILENAME,
            )

            archivo_disponible = os.path.isfile(ruta_bin)
            actualizar = (
                archivo_disponible and
                OTA_VERSION > version_cliente
            )

            print(
                "[OTA CHECK] "
                f"ESP32={version_cliente // 100}.{version_cliente % 100:02d} "
                f"SERVIDOR={OTA_VERSION // 100}.{OTA_VERSION % 100:02d} "
                f"BIN={'SI' if archivo_disponible else 'NO'} "
                f"ACTUALIZAR={'SI' if actualizar else 'NO'}"
            )

            respuesta = {
                "version": OTA_VERSION,
                "version_texto": (
                    f"{OTA_VERSION // 100}."
                    f"{OTA_VERSION % 100:02d}"
                ),
                "archivo": OTA_FILENAME,
                "actualizar": actualizar,
            }

            log_endpoint_timing(
                "OTA",
                inicio_endpoint,
                (
                    f"cliente={version_cliente} "
                    f"server={OTA_VERSION} "
                    f"actualizar={actualizar}"
                ),
            )

            return jsonify(respuesta), 200

        @app.route("/firmware/<path:filename>", methods=["GET"])
        def download_firmware(filename):
            ruta = os.path.join(FIRMWARE_DIR, filename)

            if not os.path.isfile(ruta):
                print(f"[OTA] Firmware no encontrado: {ruta}")
                abort(404)

            print(
                f"[OTA] Enviando {filename} "
                f"({os.path.getsize(ruta)} bytes)"
            )

            return send_from_directory(
                FIRMWARE_DIR,
                filename,
                as_attachment=False,
                mimetype="application/octet-stream",
            )

        @app.route("/hora", methods=["GET"])
        def obtener_hora():
            # El timestamp es universal. La zona horaria solo se usa
            # para el texto humano de diagnóstico.
            ahora_lima = datetime.now(ZoneInfo("America/Lima"))

            return jsonify({
                "status": "success",
                "timestamp": int(ahora_lima.timestamp()),
                "zona_horaria": "America/Lima",
                "fecha_hora_lima": ahora_lima.strftime(
                    "%d/%m/%Y %H:%M:%S"
                ),
            }), 200

        @app.route("/health", methods=["GET"])
        def health():
            return jsonify({
                "status": "ok",
                "modo": modo_servidor,
            }), 200

        self.server_message.emit(
            f"[SISTEMA] Servidor iniciado en http://0.0.0.0:{PORT}"
        )

        app.run(
            host=HOST,
            port=PORT,
            debug=False,
            use_reloader=False,
            threaded=True,
        )


# ============================================================
# INTERFAZ GRÁFICA
# ============================================================

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setWindowTitle(
            "Consola Central de Control - Servidor RFID & OTA"
        )
        self.resize(650, 550)

        # Contador visual de actividades recibidas.
        # Se reinicia al reiniciar la aplicación y no afecta el protocolo.
        self.contador_actividades = 0

        self.label_modo = QLabel("MODO ACTUAL: DESCONOCIDO")
        self.label_modo.setFont(
            QFont("Arial", 12, QFont.Weight.Bold)
        )
        self.label_modo.setStyleSheet(
            "color: #2ecc71; margin-bottom: 5px;"
        )

        self.label_titulo = QLabel(
            "Historial de eventos del sistema:"
        )
        self.label_titulo.setFont(
            QFont("Arial", 10, QFont.Weight.Bold)
        )

        self.log_datos = QTextEdit()
        self.log_datos.setReadOnly(True)
        self.log_datos.setFont(QFont("Courier New", 10))

        self.btn_normal = QPushButton("Modo Asistencia")
        self.btn_bloquear = QPushButton("Bloquear Asistencia")
        self.btn_registro = QPushButton("Modo Registrar")
        self.btn_test = QPushButton("Modo Test")
        self.spin_test_interval = QSpinBox()
        self.spin_test_interval.setRange(1, 60)
        self.spin_test_interval.setValue(3)
        self.spin_test_interval.setSuffix(" s")

        self.btn_normal.setStyleSheet(
            "background-color: #2ecc71;"
            "color: white;"
            "font-weight: bold;"
            "padding: 6px;"
        )

        self.btn_bloquear.setStyleSheet(
            "background-color: #e74c3c;"
            "color: white;"
            "font-weight: bold;"
            "padding: 6px;"
        )

        self.btn_registro.setStyleSheet(
            "background-color: #f39c12;"
            "color: white;"
            "font-weight: bold;"
            "padding: 6px;"
        )

        self.btn_test.setStyleSheet(
            "background-color: #3498db;"
            "color: white;"
            "font-weight: bold;"
            "padding: 6px;"
        )

        self.btn_normal.clicked.connect(
            lambda: self.cambiar_modo_sistema(
                "ASISTENCIA",
                "#2ecc71",
            )
        )

        self.btn_bloquear.clicked.connect(
            lambda: self.cambiar_modo_sistema(
                "BLOQUEADO",
                "#e74c3c",
            )
        )

        self.btn_registro.clicked.connect(
            lambda: self.cambiar_modo_sistema(
                "REGISTRO",
                "#f39c12",
            )
        )

        self.btn_test.clicked.connect(
            lambda: self.cambiar_modo_sistema(
                "TEST",
                "#3498db",
            )
        )

        self.spin_test_interval.valueChanged.connect(
            self.cambiar_intervalo_test
        )

        layout_botones = QHBoxLayout()
        layout_botones.addWidget(self.btn_normal)
        layout_botones.addWidget(self.btn_bloquear)
        layout_botones.addWidget(self.btn_registro)
        layout_botones.addWidget(self.btn_test)

        layout_test = QHBoxLayout()
        layout_test.addWidget(QLabel("Intervalo TEST:"))
        layout_test.addWidget(self.spin_test_interval)

        layout_principal = QVBoxLayout()
        layout_principal.addWidget(self.label_modo)
        layout_principal.addWidget(self.label_titulo)
        layout_principal.addWidget(self.log_datos)
        layout_principal.addLayout(layout_botones)
        layout_principal.addLayout(layout_test)

        container = QWidget()
        container.setLayout(layout_principal)
        self.setCentralWidget(container)

        self.server_thread = FlaskThread()
        self.server_thread.data_received.connect(self.update_gui)
        self.server_thread.server_message.connect(
            self.agregar_mensaje_sistema
        )
        self.server_thread.state_received.connect(
            self.actualizar_modo_desde_dispositivo
        )
        self.server_thread.start()

        self.agregar_mensaje_sistema(
            "[SISTEMA] Iniciando servidor Flask..."
        )

    def agregar_mensaje_sistema(self, mensaje):
        self.log_datos.append(mensaje)

    def actualizar_modo_desde_dispositivo(self, modo):
        colores = {
            "ASISTENCIA": "#2ecc71",
            "BLOQUEADO": "#e74c3c",
            "REGISTRO": "#f39c12",
            "TEST": "#3498db",
        }

        textos = {
            "ASISTENCIA": "ASISTENCIA",
            "BLOQUEADO": "BLOQUEADO",
            "REGISTRO": "REGISTRO",
            "TEST": "TEST",
        }

        color = colores.get(modo, "#ffffff")
        texto = textos.get(modo, modo)

        self.label_modo.setText(
            f"MODO ACTUAL: {texto}"
        )
        self.label_modo.setStyleSheet(
            f"color: {color};"
            "font-weight: bold;"
            "margin-bottom: 5px;"
        )

    def cambiar_intervalo_test(self, segundos):
        global test_interval_ms

        test_interval_ms = int(segundos) * 1000

        self.log_datos.append(
            f"[TEST] Intervalo configurado: {segundos} s"
        )

    def cambiar_modo_sistema(self, nuevo_modo, color_hex):
        global modo_deseado

        modo_deseado = nuevo_modo

        textos = {
            "ASISTENCIA": "ASISTENCIA",
            "BLOQUEADO": "BLOQUEADO",
            "REGISTRO": "REGISTRO",
            "TEST": "TEST",
        }

        self.label_modo.setText(
            f"ORDEN PENDIENTE: {textos.get(nuevo_modo, nuevo_modo)}"
        )
        self.label_modo.setStyleSheet(
            f"color: {color_hex};"
            "font-weight: bold;"
            "margin-bottom: 5px;"
        )

        self.log_datos.append(
            f"[CONSOLA] Orden solicitada: {nuevo_modo}"
        )

    def update_gui(self, data):
        uid = data.get("uid", "Desconocido")
        accion = data.get("accion", "N/A")
        timestamp = data.get("timestamp_legible", "N/A")
        dispositivo = data.get("dispositivo", "ESP32")
        habilitado = data.get("habilitado", False)
        detalle_resultado = data.get("detalleDelResultado", "")
        usuario = data.get("usuario", "Desconocido")
        modo_operado = data.get("modo_operado", "N/A")
        es_test = bool(data.get("test", False))

        self.contador_actividades += 1

        # Texto pensado para un sistema de asistencia, no para una cerradura.
        textos_detalle_resultado = {
            "HABILITADO": "HABILITADO",
            "DESHABILITADO": "DESHABILITADO",
            "NO_REGISTRADO": "NO REGISTRADO",
            "SISTEMA_BLOQUEADO": "SISTEMA BLOQUEADO",
            "REGISTRO": "REGISTRO NUEVO",  # compatibilidad anterior
            "UID_YA_EXISTE": "UID YA EXISTE",
            "UID_NUEVO": "UID NUEVO",
        }

        # Compatibilidad defensiva con respuestas antiguas.
        if detalle_resultado:
            estado_visible = textos_detalle_resultado.get(
                detalle_resultado,
                detalle_resultado,
            )
        else:
            estado_visible = "HABILITADO" if habilitado else "DESHABILITADO"

        texto = (
            f"--- Nueva actividad #{self.contador_actividades} ({dispositivo}) ---\n"
            f"UID tarjeta : {uid}\n"
            f"Acción      : {accion}\n"
            f"Usuario     : {usuario}\n"
            f"Resultado   : {estado_visible}\n"
            f"Modo        : {modo_operado}\n"
            f"Fecha/hora  : {timestamp}\n"
        )

        self.log_datos.append(texto)


# ============================================================
# EJECUCIÓN
# ============================================================

if __name__ == "__main__":
    app_qt = QApplication(sys.argv)

    ventana = MainWindow()
    ventana.show()

    sys.exit(app_qt.exec())


