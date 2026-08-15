"use client";

import { useEffect } from "react";

export type Language = "en" | "es" | "fr" | "yue" | "hi" | "ar";

export const LANGUAGES: Array<{ code: Language; flag: string; name: string; nativeName: string; dir: "ltr" | "rtl" }> = [
  { code: "en", flag: "🇺🇸", name: "English", nativeName: "English", dir: "ltr" },
  { code: "es", flag: "🇪🇸", name: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "fr", flag: "🇫🇷", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "yue", flag: "🇭🇰", name: "Cantonese", nativeName: "廣東話", dir: "ltr" },
  { code: "hi", flag: "🇮🇳", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "ar", flag: "🇸🇦", name: "Arabic", nativeName: "العربية", dir: "rtl" },
];

type Row = [string, string, string, string, string, string];
const rows: Row[] = [
  ["STRUCTURAL RESPONSE LAB", "LABORATORIO DE RESPUESTA ESTRUCTURAL", "LABORATOIRE DE RÉPONSE STRUCTURELLE", "結構反應實驗室", "संरचनात्मक प्रतिक्रिया प्रयोगशाला", "مختبر الاستجابة الإنشائية"],
  ["Structure lab", "Laboratorio estructural", "Laboratoire structurel", "結構實驗室", "संरचना प्रयोगशाला", "مختبر المنشآت"],
  ["Regional map", "Mapa regional", "Carte régionale", "區域地圖", "क्षेत्रीय मानचित्र", "الخريطة الإقليمية"],
  ["Live alerts", "Alertas en vivo", "Alertes en direct", "即時警報", "लाइव अलर्ट", "تنبيهات مباشرة"],
  ["LIVE USGS FEED", "FUENTE USGS EN VIVO", "FLUX USGS EN DIRECT", "USGS 即時資料", "लाइव USGS फ़ीड", "موجز USGS مباشر"],
  ["PAUSED", "EN PAUSA", "EN PAUSE", "已暫停", "रुका हुआ", "متوقف مؤقتًا"],
  ["Real-time earthquake alerts", "Alertas de terremotos en tiempo real", "Alertes sismiques en temps réel", "即時地震警報", "रीयल-टाइम भूकंप अलर्ट", "تنبيهات الزلازل في الوقت الفعلي"],
  ["Monitor recent earthquakes from the U.S. Geological Survey and receive optional browser notifications for new events that match your threshold.", "Monitorea terremotos recientes del Servicio Geológico de Estados Unidos y recibe notificaciones opcionales del navegador sobre nuevos eventos que coincidan con tu umbral.", "Surveillez les séismes récents de l’Institut d’études géologiques des États-Unis et recevez des notifications facultatives pour les nouveaux événements correspondant à votre seuil.", "監察美國地質調查局的近期地震，並可選擇接收符合震級門檻的新事件瀏覽器通知。", "अमेरिकी भूवैज्ञानिक सर्वेक्षण के हाल के भूकंप देखें और आपकी सीमा से मेल खाने वाली नई घटनाओं के लिए वैकल्पिक ब्राउज़र सूचनाएँ पाएँ।", "راقب الزلازل الأخيرة من هيئة المسح الجيولوجي الأمريكية وتلقَّ إشعارات متصفح اختيارية للأحداث الجديدة المطابقة للحد الذي حددته."],
  ["Alert settings", "Configuración de alertas", "Paramètres des alertes", "警報設定", "अलर्ट सेटिंग", "إعدادات التنبيه"],
  ["Updates every minute", "Se actualiza cada minuto", "Actualisation chaque minute", "每分鐘更新", "हर मिनट अपडेट", "يُحدَّث كل دقيقة"],
  ["Minimum magnitude", "Magnitud mínima", "Magnitude minimale", "最低震級", "न्यूनतम परिमाण", "الحد الأدنى للقوة"],
  ["Only earthquakes at or above this magnitude appear in the list and trigger new-event notifications.", "Solo los terremotos de esta magnitud o superior aparecen en la lista y activan notificaciones de nuevos eventos.", "Seuls les séismes de cette magnitude ou plus apparaissent dans la liste et déclenchent des notifications.", "只有達到或高於此震級的地震才會顯示並觸發新事件通知。", "केवल इस परिमाण या इससे अधिक के भूकंप सूची में दिखेंगे और नई घटना की सूचना देंगे।", "تظهر في القائمة الزلازل التي تبلغ هذه القوة أو تتجاوزها وتُفعّل إشعارات الأحداث الجديدة."],
  ["Time window", "Período de tiempo", "Période", "時間範圍", "समय अवधि", "النطاق الزمني"],
  ["Choose how far back the USGS feed should look for recent earthquakes.", "Elige cuánto tiempo atrás debe consultar la fuente de USGS.", "Choisissez jusqu’où le flux USGS doit remonter pour les séismes récents.", "選擇 USGS 資料要追溯多長時間。", "चुनें कि USGS फ़ीड हाल के भूकंपों के लिए कितने पीछे तक देखे।", "اختر المدة السابقة التي يبحث فيها موجز USGS عن الزلازل الحديثة."],
  ["Past hour", "Última hora", "Dernière heure", "過去一小時", "पिछला घंटा", "الساعة الماضية"],
  ["Past 24 hours", "Últimas 24 horas", "Dernières 24 heures", "過去 24 小時", "पिछले 24 घंटे", "آخر 24 ساعة"],
  ["Past 48 hours", "Últimas 48 horas", "Dernières 48 heures", "過去 48 小時", "पिछले 48 घंटे", "آخر 48 ساعة"],
  ["Past 72 hours", "Últimas 72 horas", "Dernières 72 heures", "過去 72 小時", "पिछले 72 घंटे", "آخر 72 ساعة"],
  ["Past 7 days", "Últimos 7 días", "7 derniers jours", "過去 7 日", "पिछले 7 दिन", "آخر 7 أيام"],
  ["Browser notifications", "Notificaciones del navegador", "Notifications du navigateur", "瀏覽器通知", "ब्राउज़र सूचनाएँ", "إشعارات المتصفح"],
  ["Opt in to desktop or mobile browser notifications for new matching events while this app remains open.", "Activa notificaciones del navegador en escritorio o móvil para nuevos eventos coincidentes mientras la aplicación esté abierta.", "Activez les notifications du navigateur sur ordinateur ou mobile pour les nouveaux événements correspondants tant que l’application reste ouverte.", "應用程式開啟期間，可選擇在桌面或流動瀏覽器接收符合條件的新事件通知。", "ऐप खुले रहने पर मेल खाने वाली नई घटनाओं के लिए डेस्कटॉप या मोबाइल ब्राउज़र सूचनाएँ चालू करें।", "فعّل إشعارات المتصفح على سطح المكتب أو الهاتف للأحداث الجديدة المطابقة ما دام التطبيق مفتوحًا."],
  ["Browser alerts work while this page remains open.", "Las alertas funcionan mientras esta página permanezca abierta.", "Les alertes fonctionnent tant que cette page reste ouverte.", "此頁面保持開啟時瀏覽器警報才會運作。", "ब्राउज़र अलर्ट इस पेज के खुले रहने पर काम करते हैं।", "تعمل تنبيهات المتصفح ما دامت هذه الصفحة مفتوحة."],
  ["Not supported", "No compatible", "Non pris en charge", "不支援", "समर्थित नहीं", "غير مدعوم"],
  ["Permission denied", "Permiso denegado", "Autorisation refusée", "權限被拒", "अनुमति अस्वीकृत", "تم رفض الإذن"],
  ["Enable alerts", "Activar alertas", "Activer les alertes", "啟用警報", "अलर्ट चालू करें", "تفعيل التنبيهات"],
  ["Disable alerts", "Desactivar alertas", "Désactiver les alertes", "停用警報", "अलर्ट बंद करें", "تعطيل التنبيهات"],
  ["Pause monitoring", "Pausar monitoreo", "Suspendre la surveillance", "暫停監察", "निगरानी रोकें", "إيقاف المراقبة مؤقتًا"],
  ["Resume monitoring", "Reanudar monitoreo", "Reprendre la surveillance", "恢復監察", "निगरानी फिर शुरू करें", "استئناف المراقبة"],
  ["Refreshing...", "Actualizando...", "Actualisation...", "更新中⋯", "अपडेट हो रहा है...", "جارٍ التحديث..."],
  ["Refresh now", "Actualizar ahora", "Actualiser", "立即更新", "अभी अपडेट करें", "تحديث الآن"],
  ["Educational monitor", "Monitor educativo", "Moniteur pédagogique", "教育監察工具", "शैक्षिक मॉनिटर", "أداة مراقبة تعليمية"],
  ["USGS data is preliminary and may be revised. This monitor is educational and is not an emergency warning service.", "Los datos de USGS son preliminares y pueden revisarse. Este monitor es educativo y no es un servicio de alerta de emergencia.", "Les données de l’USGS sont préliminaires et peuvent être révisées. Ce moniteur est pédagogique et ne constitue pas un service d’alerte d’urgence.", "USGS 資料屬初步資料，可能會修訂。本工具只供教育用途，並非緊急警報服務。", "USGS डेटा प्रारंभिक है और बदला जा सकता है। यह मॉनिटर शैक्षिक है, आपातकालीन चेतावनी सेवा नहीं।", "بيانات USGS أولية وقد تُراجع. هذه الأداة تعليمية وليست خدمة إنذار للطوارئ."],
  ["Data source: U.S. Geological Survey", "Fuente de datos: Servicio Geológico de Estados Unidos", "Source : Institut d’études géologiques des États-Unis", "資料來源：美國地質調查局", "डेटा स्रोत: अमेरिकी भूवैज्ञानिक सर्वेक्षण", "مصدر البيانات: هيئة المسح الجيولوجي الأمريكية"],
  ["USGS LIVE MONITOR", "MONITOR USGS EN VIVO", "SUIVI USGS EN DIRECT", "USGS 即時監察", "USGS लाइव मॉनिटर", "مراقب USGS المباشر"],
  ["Recent earthquakes", "Terremotos recientes", "Séismes récents", "近期地震", "हाल के भूकंप", "الزلازل الحديثة"],
  ["Last synchronized", "Última sincronización", "Dernière synchronisation", "上次同步", "अंतिम सिंक", "آخر مزامنة"],
  ["Awaiting first update", "Esperando la primera actualización", "En attente de la première mise à jour", "等待首次更新", "पहले अपडेट की प्रतीक्षा", "بانتظار التحديث الأول"],
  ["Earthquake feed summary", "Resumen de la fuente de terremotos", "Résumé du flux sismique", "地震資料摘要", "भूकंप फ़ीड सारांश", "ملخص موجز الزلازل"],
  ["GLOBAL ACTIVITY", "ACTIVIDAD GLOBAL", "ACTIVITÉ MONDIALE", "全球活動", "वैश्विक गतिविधि", "النشاط العالمي"],
  ["Worldwide earthquake map", "Mapa mundial de terremotos", "Carte mondiale des séismes", "全球地震地圖", "विश्व भूकंप मानचित्र", "خريطة الزلازل العالمية"],
  ["Select a marker to inspect an earthquake. Marker size and color increase with magnitude.", "Selecciona un marcador para consultar un terremoto. El tamaño y el color aumentan con la magnitud.", "Sélectionnez un marqueur pour examiner un séisme. Sa taille et sa couleur augmentent avec la magnitude.", "選擇標記以查看地震；標記的大小和顏色會隨震級增加。", "भूकंप देखने के लिए मार्कर चुनें। परिमाण के साथ मार्कर का आकार और रंग बढ़ता है।", "اختر علامة لفحص زلزال. يزداد حجم العلامة ووضوح لونها مع قوة الزلزال."],
  ["Reset world view", "Restablecer vista mundial", "Réinitialiser la vue mondiale", "重設全球視圖", "विश्व दृश्य रीसेट करें", "إعادة ضبط العرض العالمي"],
  ["Interactive world map of filtered USGS earthquakes", "Mapa mundial interactivo de terremotos de USGS filtrados", "Carte mondiale interactive des séismes USGS filtrés", "已篩選 USGS 地震的互動全球地圖", "फ़िल्टर किए गए USGS भूकंपों का इंटरैक्टिव विश्व मानचित्र", "خريطة عالمية تفاعلية لزلازل USGS المصفّاة"],
  ["Magnitude legend", "Leyenda de magnitud", "Légende des magnitudes", "震級圖例", "परिमाण संकेत", "دليل القوة"],
  ["events on map", "eventos en el mapa", "événements sur la carte", "個地圖事件", "मानचित्र पर घटनाएँ", "أحداث على الخريطة"],
  ["Close map event details", "Cerrar detalles del evento del mapa", "Fermer les détails de l’événement", "關閉地圖事件詳情", "मानचित्र घटना विवरण बंद करें", "إغلاق تفاصيل حدث الخريطة"],
  ["Matching events", "Eventos coincidentes", "Événements correspondants", "符合事件", "मेल खाती घटनाएँ", "الأحداث المطابقة"],
  ["Largest event", "Evento de mayor magnitud", "Événement le plus fort", "最大事件", "सबसे बड़ी घटना", "أقوى حدث"],
  ["Tsunami flags", "Alertas de tsunami", "Indicateurs de tsunami", "海嘯標記", "सुनामी संकेत", "إشارات تسونامي"],
  ["Reviewed", "Revisado", "Révisé", "已審核", "समीक्षित", "تمت المراجعة"],
  ["Newest first", "Más recientes primero", "Plus récents d’abord", "最新優先", "नवीनतम पहले", "الأحدث أولًا"],
  ["Monitoring active", "Monitoreo activo", "Surveillance active", "監察中", "निगरानी सक्रिय", "المراقبة نشطة"],
  ["Monitoring paused", "Monitoreo en pausa", "Surveillance suspendue", "監察已暫停", "निगरानी रुकी", "المراقبة متوقفة"],
  ["Unable to reach the USGS earthquake service.", "No se pudo acceder al servicio de terremotos de USGS.", "Impossible de joindre le service sismique de l’USGS.", "無法連接 USGS 地震服務。", "USGS भूकंप सेवा से संपर्क नहीं हो सका।", "تعذر الوصول إلى خدمة الزلازل التابعة لـ USGS."],
  ["Try again", "Intentar de nuevo", "Réessayer", "再試一次", "फिर कोशिश करें", "إعادة المحاولة"],
  ["Connecting to the USGS feed...", "Conectando con la fuente de USGS...", "Connexion au flux USGS...", "正在連接 USGS 資料⋯", "USGS फ़ीड से जुड़ रहा है...", "جارٍ الاتصال بموجز USGS..."],
  ["No earthquakes match these filters.", "Ningún terremoto coincide con estos filtros.", "Aucun séisme ne correspond à ces filtres.", "沒有地震符合這些篩選條件。", "इन फ़िल्टर से कोई भूकंप मेल नहीं खाता।", "لا توجد زلازل تطابق عوامل التصفية."],
  ["Lower the minimum magnitude or select a wider time window.", "Reduce la magnitud mínima o selecciona un período más amplio.", "Réduisez la magnitude minimale ou choisissez une période plus large.", "降低最低震級或選擇較長的時間範圍。", "न्यूनतम परिमाण घटाएँ या लंबी समय अवधि चुनें।", "خفّض الحد الأدنى للقوة أو اختر نطاقًا زمنيًا أوسع."],
  ["Earthquake detected", "Terremoto detectado", "Séisme détecté", "偵測到地震", "भूकंप का पता चला", "تم رصد زلزال"],
  ["Location unavailable", "Ubicación no disponible", "Lieu indisponible", "位置不詳", "स्थान उपलब्ध नहीं", "الموقع غير متاح"],
  ["New", "Nuevo", "Nouveau", "新增", "नया", "جديد"],
  ["USGS alert", "Alerta USGS", "Alerte USGS", "USGS 警報", "USGS अलर्ट", "تنبيه USGS"],
  ["Tsunami flag", "Alerta de tsunami", "Indicateur de tsunami", "海嘯標記", "सुनामी संकेत", "إشارة تسونامي"],
  ["Depth", "Profundidad", "Profondeur", "深度", "गहराई", "العمق"],
  ["Coordinates", "Coordenadas", "Coordonnées", "座標", "निर्देशांक", "الإحداثيات"],
  ["Felt reports", "Reportes sentidos", "Témoignages", "有感報告", "महसूस होने की रिपोर्ट", "بلاغات الشعور بالهزة"],
  ["Status", "Estado", "Statut", "狀態", "स्थिति", "الحالة"],
  ["Automatic", "Automático", "Automatique", "自動", "स्वचालित", "تلقائي"],
  ["Details on USGS", "Detalles en USGS", "Détails sur l’USGS", "USGS 詳情", "USGS पर विवरण", "التفاصيل على USGS"],
  ["LIVE MODEL", "MODELO EN VIVO", "MODÈLE EN DIRECT", "即時模型", "लाइव मॉडल", "نموذج مباشر"],
  ["Help, walkthrough & contact", "Ayuda, recorrido y contacto", "Aide, visite guidée et contact", "說明、導覽及聯絡", "सहायता, मार्गदर्शन और संपर्क", "المساعدة والجولة والتواصل"],
  ["Language", "Idioma", "Langue", "語言", "भाषा", "اللغة"],
  ["Simulator mode", "Modo del simulador", "Mode du simulateur", "模擬器模式", "सिम्युलेटर मोड", "وضع المحاكي"],
  ["Open help center", "Abrir centro de ayuda", "Ouvrir le centre d’aide", "開啟說明中心", "सहायता केंद्र खोलें", "فتح مركز المساعدة"],
  ["Close help center", "Cerrar centro de ayuda", "Fermer le centre d’aide", "關閉說明中心", "सहायता केंद्र बंद करें", "إغلاق مركز المساعدة"],
  ["Help sections", "Secciones de ayuda", "Sections d’aide", "說明章節", "सहायता अनुभाग", "أقسام المساعدة"],
  ["Configuration group", "Grupo de configuración", "Groupe de configuration", "設定群組", "कॉन्फ़िगरेशन समूह", "مجموعة الإعداد"],
  ["Viewport zoom controls", "Controles de zoom de la vista", "Commandes de zoom de la vue", "視窗縮放控制", "दृश्य ज़ूम नियंत्रण", "عناصر تكبير العرض"],
  ["Simulation speed", "Velocidad de simulación", "Vitesse de simulation", "模擬速度", "सिमुलेशन गति", "سرعة المحاكاة"],
  ["Exit walkthrough", "Salir del recorrido", "Quitter la visite", "退出導覽", "मार्गदर्शिका से बाहर निकलें", "الخروج من الجولة"],
  ["City or place", "Ciudad o lugar", "Ville ou lieu", "城市或地點", "शहर या स्थान", "مدينة أو مكان"],
  ["Place search results", "Resultados de búsqueda de lugares", "Résultats de recherche de lieux", "地點搜尋結果", "स्थान खोज परिणाम", "نتائج البحث عن الأماكن"],
  ["Interactive OpenStreetMap earthquake impact map", "Mapa interactivo de impacto sísmico de OpenStreetMap", "Carte interactive d’impact sismique OpenStreetMap", "互動 OpenStreetMap 地震影響地圖", "इंटरैक्टिव OpenStreetMap भूकंप प्रभाव मानचित्र", "خريطة OpenStreetMap تفاعلية للتأثير الزلزالي"],
  ["INPUT PARAMETERS", "PARÁMETROS DE ENTRADA", "PARAMÈTRES D’ENTRÉE", "輸入參數", "इनपुट पैरामीटर", "معلمات الإدخال"],
  ["Earthquake profile", "Perfil del terremoto", "Profil du séisme", "地震設定", "भूकंप प्रोफ़ाइल", "ملف الزلزال"],
  ["Reset", "Restablecer", "Réinitialiser", "重設", "रीसेट", "إعادة ضبط"],
  ["Ground motion", "Movimiento del suelo", "Mouvement du sol", "地面運動", "भूमि गति", "حركة الأرض"],
  ["Structure", "Estructura", "Structure", "結構", "संरचना", "المنشأ"],
  ["Earthquake and soil inputs", "Parámetros del terremoto y del suelo", "Paramètres du séisme et du sol", "地震及土壤輸入", "भूकंप और मिट्टी इनपुट", "مدخلات الزلزال والتربة"],
  ["Asset, frame and design inputs", "Activo, sistema y parámetros de diseño", "Ouvrage, ossature et paramètres de conception", "資產、框架及設計輸入", "परिसंपत्ति, फ्रेम और डिज़ाइन इनपुट", "مدخلات الأصل والإطار والتصميم"],
  ["Magnitude", "Magnitud", "Magnitude", "震級", "परिमाण", "القوة"],
  ["Perceived intensity", "Intensidad percibida", "Intensité ressentie", "感知烈度", "अनुभूत तीव्रता", "الشدة المحسوسة"],
  ["Peak amplitude", "Amplitud máxima", "Amplitude maximale", "峰值振幅", "अधिकतम आयाम", "السعة القصوى"],
  ["Dominant frequency", "Frecuencia dominante", "Fréquence dominante", "主頻率", "प्रमुख आवृत्ति", "التردد السائد"],
  ["Site class", "Clase de sitio", "Classe de site", "場地類別", "साइट वर्ग", "فئة الموقع"],
  ["Site amplification", "Amplificación del sitio", "Amplification du site", "場地放大效應", "साइट प्रवर्धन", "تضخيم الموقع"],
  ["Structure type", "Tipo de estructura", "Type de structure", "結構類型", "संरचना प्रकार", "نوع المنشأ"],
  ["Structural system", "Sistema estructural", "Système structurel", "結構系統", "संरचनात्मक प्रणाली", "النظام الإنشائي"],
  ["Number of floors", "Número de pisos", "Nombre d’étages", "樓層數目", "मंजिलों की संख्या", "عدد الطوابق"],
  ["Floor height", "Altura de piso", "Hauteur d’étage", "樓層高度", "मंजिल की ऊँचाई", "ارتفاع الطابق"],
  ["Vehicle occupancy", "Ocupación vehicular", "Occupation des véhicules", "車輛佔用率", "वाहन अधिभोग", "إشغال المركبات"],
  ["Damping ratio", "Relación de amortiguamiento", "Taux d’amortissement", "阻尼比", "अवमंदन अनुपात", "نسبة التخميد"],
  ["Drift limit", "Límite de deriva", "Limite de dérive", "層間位移限值", "ड्रिफ्ट सीमा", "حد الانجراف"],
  ["Response modification", "Modificación de respuesta", "Modification de réponse", "反應修正", "प्रतिक्रिया संशोधन", "تعديل الاستجابة"],
  ["Importance factor", "Factor de importancia", "Facteur d’importance", "重要性系數", "महत्व गुणांक", "معامل الأهمية"],
  ["Material reliability", "Confiabilidad del material", "Fiabilité du matériau", "材料可靠度", "सामग्री विश्वसनीयता", "موثوقية المواد"],
  ["MODEL", "MODELO", "MODÈLE", "模型", "मॉडल", "النموذج"],
  ["Drag to orbit · Scroll to zoom", "Arrastra para orbitar · Desplázate para ampliar", "Glissez pour pivoter · Faites défiler pour zoomer", "拖曳旋轉 · 滾動縮放", "घुमाने के लिए खींचें · ज़ूम के लिए स्क्रॉल करें", "اسحب للدوران · مرر للتكبير"],
  ["GROUND MOTION", "MOVIMIENTO DEL SUELO", "MOUVEMENT DU SOL", "地面運動", "भूमि गति", "حركة الأرض"],
  ["STRUCTURAL STATE", "ESTADO ESTRUCTURAL", "ÉTAT STRUCTUREL", "結構狀態", "संरचनात्मक स्थिति", "الحالة الإنشائية"],
  ["Pause simulation", "Pausar simulación", "Mettre la simulation en pause", "暫停模擬", "सिमुलेशन रोकें", "إيقاف المحاكاة مؤقتًا"],
  ["Play simulation", "Reproducir simulación", "Lancer la simulation", "播放模擬", "सिमुलेशन चलाएँ", "تشغيل المحاكاة"],
  ["Restart simulation", "Reiniciar simulación", "Redémarrer la simulation", "重新開始模擬", "सिमुलेशन पुनः आरंभ करें", "إعادة تشغيل المحاكاة"],
  ["LIVE ANALYSIS", "ANÁLISIS EN VIVO", "ANALYSE EN DIRECT", "即時分析", "लाइव विश्लेषण", "تحليل مباشر"],
  ["Response metrics", "Métricas de respuesta", "Mesures de réponse", "反應指標", "प्रतिक्रिया मापदंड", "مقاييس الاستجابة"],
  ["MODIFIED MERCALLI", "MERCALLI MODIFICADA", "MERCALLI MODIFIÉE", "修訂麥加利", "संशोधित मर्कैली", "ميركالي المعدل"],
  ["SPECTRAL ACCEL.", "ACELERACIÓN ESPECTRAL", "ACCÉL. SPECTRALE", "譜加速度", "स्पेक्ट्रल त्वरण", "التسارع الطيفي"],
  ["FUNDAMENTAL PERIOD", "PERÍODO FUNDAMENTAL", "PÉRIODE FONDAMENTALE", "基本週期", "मूल आवर्तकाल", "الفترة الأساسية"],
  ["BASE SHEAR", "CORTANTE BASAL", "CISAILLEMENT DE BASE", "基底剪力", "आधार कतरनी", "قص القاعدة"],
  ["INTERSTORY DRIFT", "DERIVA ENTRE PISOS", "DÉRIVE INTER-ÉTAGE", "層間位移", "अंतर-मंजिला ड्रिफ्ट", "انجراف الطوابق"],
  ["PASS", "CUMPLE", "CONFORME", "通過", "उत्तीर्ण", "مقبول"],
  ["EXCEEDS", "EXCEDE", "DÉPASSE", "超出", "सीमा से अधिक", "متجاوز"],
  ["DESIGN COEFFICIENTS", "COEFICIENTES DE DISEÑO", "COEFFICIENTS DE CONCEPTION", "設計系數", "डिज़ाइन गुणांक", "معاملات التصميم"],
  ["CONFIGURABLE", "CONFIGURABLE", "CONFIGURABLE", "可設定", "कॉन्फ़िगर योग्य", "قابل للضبط"],
  ["Reliability factor", "Factor de confiabilidad", "Facteur de fiabilité", "可靠度系數", "विश्वसनीयता गुणांक", "معامل الموثوقية"],
  ["Download PDF report", "Descargar informe PDF", "Télécharger le rapport PDF", "下載 PDF 報告", "PDF रिपोर्ट डाउनलोड करें", "تنزيل تقرير PDF"],
  ["Generating PDF...", "Generando PDF…", "Génération du PDF…", "正在產生 PDF…", "PDF बनाया जा रहा है…", "جارٍ إنشاء PDF…"],
  ["Professional-use disclaimer:", "Aviso de uso profesional:", "Avertissement d’usage professionnel :", "專業用途免責聲明：", "पेशेवर उपयोग अस्वीकरण:", "إخلاء مسؤولية الاستخدام المهني:"],
  ["SEISMIC SUPPORT", "SOPORTE DE SEISMIC", "ASSISTANCE SEISMIC", "SEISMIC 支援", "SEISMIC सहायता", "دعم SEISMIC"],
  ["Help center", "Centro de ayuda", "Centre d’aide", "說明中心", "सहायता केंद्र", "مركز المساعدة"],
  ["How to use", "Cómo usar", "Mode d’emploi", "使用方法", "उपयोग कैसे करें", "كيفية الاستخدام"],
  ["Walkthrough", "Recorrido", "Visite guidée", "導覽", "मार्गदर्शिका", "جولة إرشادية"],
  ["Contact", "Contacto", "Contact", "聯絡", "संपर्क", "التواصل"],
  ["Build a seismic scenario", "Crea un escenario sísmico", "Créez un scénario sismique", "建立地震情境", "भूकंपीय परिदृश्य बनाएँ", "أنشئ سيناريو زلزاليًا"],
  ["Configure the structure", "Configura la estructura", "Configurez la structure", "設定結構", "संरचना कॉन्फ़िगर करें", "اضبط المنشأ"],
  ["Observe and interpret", "Observa e interpreta", "Observez et interprétez", "觀察及理解", "देखें और समझें", "راقب وفسّر"],
  ["Export the study", "Exporta el estudio", "Exportez l’étude", "匯出研究", "अध्ययन निर्यात करें", "صدّر الدراسة"],
  ["Quick reference", "Referencia rápida", "Référence rapide", "快速參考", "त्वरित संदर्भ", "مرجع سريع"],
  ["Model scope", "Alcance del modelo", "Portée du modèle", "模型範圍", "मॉडल का दायरा", "نطاق النموذج"],
  ["Take the guided tour", "Realiza el recorrido guiado", "Suivez la visite guidée", "開始導覽", "निर्देशित भ्रमण लें", "ابدأ الجولة الإرشادية"],
  ["Start walkthrough", "Iniciar recorrido", "Démarrer la visite", "開始導覽", "मार्गदर्शन शुरू करें", "ابدأ الجولة"],
  ["Connect with Diego Avella", "Conecta con Diego Avella", "Contactez Diego Avella", "聯絡 Diego Avella", "Diego Avella से जुड़ें", "تواصل مع Diego Avella"],
  ["GEOGRAPHIC SCENARIO", "ESCENARIO GEOGRÁFICO", "SCÉNARIO GÉOGRAPHIQUE", "地理情境", "भौगोलिक परिदृश्य", "السيناريو الجغرافي"],
  ["Regional shaking model", "Modelo regional de sacudida", "Modèle régional de secousse", "區域震動模型", "क्षेत्रीय कंपन मॉडल", "نموذج الاهتزاز الإقليمي"],
  ["Set epicenter", "Definir epicentro", "Définir l’épicentre", "設定震央", "उपरिकेंद्र निर्धारित करें", "تحديد المركز السطحي"],
  ["Cancel epicenter placement", "Cancelar ubicación del epicentro", "Annuler le placement de l’épicentre", "取消設定震央", "उपरिकेंद्र निर्धारण रद्द करें", "إلغاء تحديد المركز"],
  ["Choose an exact point interactively", "Elige un punto exacto de forma interactiva", "Choisissez précisément un point", "互動選擇準確位置", "सटीक बिंदु चुनें", "اختر نقطة دقيقة تفاعليًا"],
  ["Find a city or place", "Buscar una ciudad o lugar", "Rechercher une ville ou un lieu", "搜尋城市或地點", "शहर या स्थान खोजें", "ابحث عن مدينة أو مكان"],
  ["Search", "Buscar", "Rechercher", "搜尋", "खोजें", "بحث"],
  ["Searching…", "Buscando…", "Recherche…", "搜尋中…", "खोज जारी है…", "جارٍ البحث…"],
  ["Focal depth", "Profundidad focal", "Profondeur focale", "震源深度", "केंद्र गहराई", "عمق البؤرة"],
  ["Analysis radius", "Radio de análisis", "Rayon d’analyse", "分析半徑", "विश्लेषण त्रिज्या", "نصف قطر التحليل"],
  ["Representative site class", "Clase de sitio representativa", "Classe de site représentative", "代表性場地類別", "प्रतिनिधि साइट वर्ग", "فئة الموقع التمثيلية"],
  ["Latitude", "Latitud", "Latitude", "緯度", "अक्षांश", "خط العرض"],
  ["Longitude", "Longitud", "Longitude", "經度", "देशांतर", "خط الطول"],
  ["OPENSTREETMAP IMPACT MAP", "MAPA DE IMPACTO OPENSTREETMAP", "CARTE D’IMPACT OPENSTREETMAP", "OPENSTREETMAP 影響地圖", "OPENSTREETMAP प्रभाव मानचित्र", "خريطة التأثير OPENSTREETMAP"],
  ["Highest", "Mayor", "Élevé", "最高", "उच्चतम", "الأعلى"],
  ["Moderate", "Moderado", "Modéré", "中等", "मध्यम", "متوسط"],
  ["Lower", "Menor", "Faible", "較低", "निम्न", "الأدنى"],
  ["AREA ANALYSIS", "ANÁLISIS DEL ÁREA", "ANALYSE DE LA ZONE", "區域分析", "क्षेत्र विश्लेषण", "تحليل المنطقة"],
  ["Scenario summary", "Resumen del escenario", "Résumé du scénario", "情境摘要", "परिदृश्य सारांश", "ملخص السيناريو"],
  ["Epicenter PGA", "PGA del epicentro", "PGA à l’épicentre", "震央 PGA", "उपरिकेंद्र PGA", "PGA عند المركز"],
  ["Outer-edge PGA", "PGA del borde exterior", "PGA en bordure externe", "外緣 PGA", "बाहरी किनारे PGA", "PGA عند الحافة الخارجية"],
  ["Modeled area", "Área modelada", "Zone modélisée", "模擬範圍", "मॉडल क्षेत्र", "المساحة النموذجية"],
  ["Distance profile", "Perfil de distancia", "Profil de distance", "距離剖面", "दूरी प्रोफ़ाइल", "ملف المسافة"],
  ["Download regional PDF", "Descargar PDF regional", "Télécharger le PDF régional", "下載區域 PDF", "क्षेत्रीय PDF डाउनलोड करें", "تنزيل PDF الإقليمي"],
  ["Screening model only", "Solo modelo de evaluación preliminar", "Modèle de dépistage uniquement", "只作初步評估", "केवल प्रारंभिक मॉडल", "نموذج فحص أولي فقط"],
  ["Hard rock", "Roca dura", "Roche dure", "硬岩", "कठोर चट्टान", "صخر صلب"],
  ["Rock", "Roca", "Roche", "岩石", "चट्टान", "صخر"],
  ["Very dense soil and soft rock", "Suelo muy denso y roca blanda", "Sol très dense et roche tendre", "極密土壤及軟岩", "बहुत घनी मिट्टी और नरम चट्टान", "تربة كثيفة جدًا وصخر لين"],
  ["Stiff soil", "Suelo rígido", "Sol ferme", "硬土", "कठोर मिट्टी", "تربة صلبة"],
  ["Soft clay soil", "Suelo de arcilla blanda", "Sol argileux mou", "軟黏土", "नरम चिकनी मिट्टी", "تربة طينية رخوة"],
  ["Site-specific evaluation", "Evaluación específica del sitio", "Évaluation spécifique au site", "場地專項評估", "साइट-विशिष्ट मूल्यांकन", "تقييم خاص بالموقع"],
  ["Building", "Edificio", "Bâtiment", "建築物", "इमारत", "مبنى"],
  ["House", "Casa", "Maison", "住宅", "घर", "منزل"],
  ["Garage", "Garaje", "Garage", "車房", "गैराज", "مرآب"],
  ["Shed", "Cobertizo", "Hangar", "棚屋", "शेड", "سقيفة"],
  ["Skyscraper", "Rascacielos", "Gratte-ciel", "摩天大樓", "गगनचुंबी इमारत", "ناطحة سحاب"],
  ["Warehouse", "Almacén", "Entrepôt", "倉庫", "गोदाम", "مستودع"],
  ["Mall", "Centro comercial", "Centre commercial", "商場", "मॉल", "مركز تجاري"],
  ["Bridge", "Puente", "Pont", "橋樑", "पुल", "جسر"],
  ["Tower", "Torre", "Tour", "塔", "मीनार", "برج"],
  ["Tunnel", "Túnel", "Tunnel", "隧道", "सुरंग", "نفق"],
  ["Parking garage", "Garaje de estacionamiento", "Garage de stationnement", "停車庫", "पार्किंग गैराज", "مرآب سيارات"],
  ["Parking structure", "Estructura de estacionamiento", "Structure de stationnement", "停車場結構", "पार्किंग संरचना", "منشأ مواقف"],
  ["Multi-story car park", "Estacionamiento de varios pisos", "Parking à étages", "多層停車場", "बहुमंजिला कार पार्क", "موقف سيارات متعدد الطوابق"],
  ["RC moment frame", "Pórtico resistente a momento de concreto reforzado", "Portique en béton armé résistant aux moments", "鋼筋混凝土抗彎框架", "आरसी मोमेंट फ्रेम", "إطار خرساني مقاوم للعزوم"],
  ["Steel braced frame", "Pórtico arriostrado de acero", "Portique contreventé en acier", "鋼斜撐框架", "स्टील ब्रेस्ड फ्रेम", "إطار فولاذي مدعم"],
  ["Reinforced masonry", "Mampostería reforzada", "Maçonnerie armée", "加固砌體", "प्रबलित चिनाई", "مبانٍ مسلحة"],
  ["Timber frame", "Estructura de madera", "Ossature bois", "木框架", "लकड़ी का फ्रेम", "إطار خشبي"],
  ["Class", "Clase", "Classe", "類別", "वर्ग", "الفئة"],
  ["Zoom in", "Acercar", "Zoom avant", "放大", "ज़ूम इन", "تكبير"],
  ["Zoom out", "Alejar", "Zoom arrière", "縮小", "ज़ूम आउट", "تصغير"],
  ["Fit structure to view", "Ajustar estructura a la vista", "Ajuster la structure à la vue", "結構適應視窗", "संरचना को दृश्य में फिट करें", "ملاءمة المنشأ مع العرض"],
  ["Fit model to view", "Ajustar modelo a la vista", "Ajuster le modèle à la vue", "模型適應視窗", "मॉडल को दृश्य में फिट करें", "ملاءمة النموذج مع العرض"],
  ["Resume simulation", "Reanudar simulación", "Reprendre la simulation", "繼續模擬", "सिमुलेशन फिर शुरू करें", "استئناف المحاكاة"],
  ["Restart from zero", "Reiniciar desde cero", "Recommencer depuis zéro", "由零重新開始", "शून्य से पुनः आरंभ करें", "إعادة البدء من الصفر"],
  ["Export current inputs and results as PDF", "Exportar los parámetros y resultados actuales en PDF", "Exporter les paramètres et résultats actuels en PDF", "將目前輸入及結果匯出為 PDF", "वर्तमान इनपुट और परिणाम PDF में निर्यात करें", "تصدير المدخلات والنتائج الحالية بصيغة PDF"],
  ["Export the regional map, impact rings, inputs, and results as PDF", "Exportar el mapa regional, los anillos de impacto, los parámetros y los resultados en PDF", "Exporter la carte régionale, les anneaux d’impact, les paramètres et les résultats en PDF", "將區域地圖、影響圈、輸入及結果匯出為 PDF", "क्षेत्रीय मानचित्र, प्रभाव वलय, इनपुट और परिणाम PDF में निर्यात करें", "تصدير الخريطة الإقليمية وحلقات التأثير والمدخلات والنتائج بصيغة PDF"],
  ["Creating PDF…", "Creando PDF…", "Création du PDF…", "正在建立 PDF…", "PDF बनाया जा रहा है…", "جارٍ إنشاء PDF…"],
  ["limit", "límite", "limite", "限值", "सीमा", "الحد"],
  ["Includes the current map, impact rings, inputs, calculated results, OpenStreetMap attribution, and professional-use disclaimer.", "Incluye el mapa actual, los anillos de impacto, los parámetros, los resultados calculados, la atribución de OpenStreetMap y el aviso de uso profesional.", "Comprend la carte actuelle, les anneaux d’impact, les paramètres, les résultats calculés, l’attribution OpenStreetMap et l’avertissement professionnel.", "包括目前地圖、影響圈、輸入、計算結果、OpenStreetMap 署名及專業用途免責聲明。", "इसमें वर्तमान मानचित्र, प्रभाव वलय, इनपुट, गणना परिणाम, OpenStreetMap श्रेय और पेशेवर उपयोग अस्वीकरण शामिल हैं।", "يتضمن الخريطة الحالية وحلقات التأثير والمدخلات والنتائج المحسوبة ونسبة OpenStreetMap وإخلاء مسؤولية الاستخدام المهني."],
  ["Operational", "Operativa", "Opérationnel", "運作正常", "परिचालन योग्य", "تشغيلي"],
  ["Slight damage", "Daño leve", "Dommages légers", "輕微損壞", "हल्की क्षति", "ضرر طفيف"],
  ["Moderate damage", "Daño moderado", "Dommages modérés", "中度損壞", "मध्यम क्षति", "ضرر متوسط"],
  ["Extensive damage", "Daño extenso", "Dommages importants", "嚴重損壞", "व्यापक क्षति", "ضرر واسع"],
  ["Severe / collapse risk", "Riesgo grave / colapso", "Risque grave / effondrement", "嚴重／倒塌風險", "गंभीर / ढहने का जोखिम", "خطر شديد / انهيار"],
  ["Back", "Atrás", "Retour", "返回", "पीछे", "السابق"],
  ["Next", "Siguiente", "Suivant", "下一步", "अगला", "التالي"],
  ["Finish", "Finalizar", "Terminer", "完成", "समाप्त", "إنهاء"],
  ["Exit tour", "Salir del recorrido", "Quitter la visite", "退出導覽", "भ्रमण छोड़ें", "إنهاء الجولة"],
  ["A logarithmic measure of the earthquake's released energy. Each whole-number increase represents substantially stronger shaking.", "Medida logarítmica de la energía liberada por el terremoto. Cada número entero adicional representa una sacudida considerablemente mayor.", "Mesure logarithmique de l’énergie libérée par le séisme. Chaque unité entière représente une secousse nettement plus forte.", "地震釋放能量嘅對數量度；每增加一級，震動都會顯著增強。", "भूकंप से मुक्त ऊर्जा का लघुगणकीय माप। प्रत्येक पूर्ण अंक की वृद्धि काफी अधिक कंपन दर्शाती है।", "مقياس لوغاريتمي للطاقة التي يطلقها الزلزال؛ وتمثل كل زيادة صحيحة اهتزازًا أقوى بكثير."],
  ["The expected severity of shaking and observed effects at the structure, expressed on the 1–12 Modified Mercalli scale.", "Severidad esperada de la sacudida y efectos observados en la estructura, expresados en la escala de Mercalli Modificada de 1 a 12.", "Sévérité attendue des secousses et effets observés sur la structure, selon l’échelle de Mercalli modifiée de 1 à 12.", "預期震動程度及結構可觀察影響，以 1 至 12 級修訂麥加利烈度表示。", "संरचना पर अपेक्षित कंपन और देखे गए प्रभाव, 1–12 संशोधित मर्कैली पैमाने पर।", "شدة الاهتزاز المتوقعة وآثاره الملحوظة على المنشأ وفق مقياس ميركالي المعدل من 1 إلى 12."],
  ["The maximum modeled ground acceleration, expressed as a fraction of gravity (g). It directly influences inertial force.", "Aceleración máxima modelada del suelo, expresada como fracción de la gravedad (g). Influye directamente en la fuerza inercial.", "Accélération maximale modélisée du sol, exprimée en fraction de la gravité (g). Elle influence directement la force d’inertie.", "模擬地面最大加速度，以重力加速度 g 嘅比例表示，直接影響慣性力。", "मॉडल किया गया अधिकतम भूमि त्वरण, गुरुत्व (g) के अंश में। यह जड़त्व बल को सीधे प्रभावित करता है।", "أقصى تسارع أرضي نمذجي كنسبة من الجاذبية (g)، ويؤثر مباشرة في قوة القصور الذاتي."],
  ["The principal repetition rate of ground motion. Response can increase when it approaches the structure's natural frequency.", "Frecuencia principal del movimiento del suelo. La respuesta puede aumentar cuando se aproxima a la frecuencia natural de la estructura.", "Fréquence principale du mouvement du sol. La réponse peut augmenter lorsqu’elle approche la fréquence propre de la structure.", "地面運動嘅主要重複頻率；接近結構自然頻率時，反應可能增大。", "भूमि गति की प्रमुख पुनरावृत्ति दर। संरचना की प्राकृतिक आवृत्ति के निकट प्रतिक्रिया बढ़ सकती है।", "معدل التكرار الرئيسي لحركة الأرض، وقد تزداد الاستجابة عند اقترابه من التردد الطبيعي للمنشأ."],
  ["A–F soil and rock classification used to estimate how local ground conditions amplify shaking. Class A is hard rock; softer classes generally amplify more.", "Clasificación A–F de suelos y rocas para estimar cómo las condiciones locales amplifican la sacudida. La clase A es roca dura; las clases más blandas suelen amplificar más.", "Classification A–F des sols et roches servant à estimer l’amplification locale. La classe A correspond à la roche dure ; les classes plus meubles amplifient généralement davantage.", "A 至 F 土壤及岩石分類，用嚟估算本地地質對震動嘅放大；A 類係硬岩，較軟場地通常放大更多。", "स्थानीय भूमि स्थितियों द्वारा कंपन प्रवर्धन के अनुमान हेतु A–F मिट्टी और चट्टान वर्गीकरण। A कठोर चट्टान है; नरम वर्ग सामान्यतः अधिक प्रवर्धित करते हैं।", "تصنيف للتربة والصخور من A إلى F لتقدير تضخيم ظروف الموقع للاهتزاز؛ الفئة A صخر صلب والفئات الألين تضخم أكثر عادةً."],
  ["The asset geometry being modeled. This selection changes allowed floor counts, dimensions, mass, stiffness assumptions, and the 3D representation.", "Geometría del activo modelado. Esta selección modifica los pisos permitidos, dimensiones, masa, rigidez y representación 3D.", "Géométrie de l’ouvrage modélisé. Ce choix modifie le nombre d’étages, les dimensions, la masse, la rigidité et la représentation 3D.", "所模擬資產嘅幾何形狀；選擇會改變樓層限制、尺寸、質量、剛度假設及 3D 顯示。", "मॉडल की गई परिसंपत्ति की ज्यामिति। चयन अनुमत मंजिलें, आयाम, द्रव्यमान, कठोरता और 3D रूप बदलता है।", "هندسة الأصل الجاري نمذجته؛ ويغير الاختيار عدد الطوابق والأبعاد والكتلة والصلابة والتمثيل ثلاثي الأبعاد."],
  ["The primary lateral-force-resisting material and framing system used to estimate stiffness, period, and energy-dissipation behavior.", "Material y sistema principal que resiste fuerzas laterales, usado para estimar rigidez, período y disipación de energía.", "Matériau et système principal résistant aux forces latérales, utilisés pour estimer la rigidité, la période et la dissipation d’énergie.", "用嚟估算剛度、週期及耗能行為嘅主要抗側力材料同框架系統。", "कठोरता, आवर्तकाल और ऊर्जा अपव्यय का अनुमान लगाने वाली मुख्य पार्श्व-बल प्रतिरोधी सामग्री और फ्रेम प्रणाली।", "المادة ونظام الإطار الرئيسيان لمقاومة القوى الجانبية وتقدير الصلابة والفترة وتبديد الطاقة."],
  ["The number of occupied or modeled levels. It controls total height, approximate mass distribution, period, and the rendered model.", "Número de niveles ocupados o modelados. Controla la altura total, la distribución aproximada de masa, el período y el modelo renderizado.", "Nombre de niveaux occupés ou modélisés. Il contrôle la hauteur totale, la répartition approximative de masse, la période et le modèle affiché.", "佔用或模擬嘅樓層數目，控制總高度、概約質量分布、週期及顯示模型。", "अधिभोगित या मॉडल की गई मंजिलों की संख्या। यह कुल ऊँचाई, अनुमानित द्रव्यमान वितरण, आवर्तकाल और रेंडर मॉडल नियंत्रित करती है।", "عدد المستويات المشغولة أو النموذجية، ويتحكم في الارتفاع الكلي وتوزيع الكتلة التقريبي والفترة والنموذج المعروض."],
  ["The vertical distance between consecutive floor levels. Together with floor count, it determines total structural height.", "Distancia vertical entre pisos consecutivos. Junto con el número de pisos determina la altura estructural total.", "Distance verticale entre niveaux consécutifs. Avec le nombre d’étages, elle détermine la hauteur totale.", "相鄰樓層之間嘅垂直距離，配合樓層數目決定結構總高度。", "लगातार मंजिलों के बीच ऊर्ध्वाधर दूरी। मंजिल संख्या के साथ यह कुल संरचनात्मक ऊँचाई निर्धारित करती है।", "المسافة الرأسية بين الطوابق المتتالية، وتحدد مع عدد الطوابق الارتفاع الإنشائي الكلي."],
  ["The estimated percentage of parking spaces occupied. More vehicles increase the modeled seismic mass and structural demand.", "Porcentaje estimado de plazas ocupadas. Más vehículos aumentan la masa sísmica modelada y la demanda estructural.", "Pourcentage estimé de places occupées. Davantage de véhicules augmentent la masse sismique et la demande structurelle.", "估算已使用泊車位百分比；車輛越多，模擬地震質量同結構需求越高。", "भरे हुए पार्किंग स्थानों का अनुमानित प्रतिशत। अधिक वाहन मॉडल भूकंपीय द्रव्यमान और संरचनात्मक मांग बढ़ाते हैं।", "النسبة التقديرية لمواقف السيارات المشغولة؛ وتزيد المركبات الكتلة الزلزالية النموذجية والطلب الإنشائي."],
  ["The percentage of critical damping used to represent how quickly the structure dissipates vibration energy.", "Porcentaje de amortiguamiento crítico que representa la rapidez con que la estructura disipa la energía vibratoria.", "Pourcentage d’amortissement critique représentant la vitesse à laquelle la structure dissipe l’énergie vibratoire.", "表示結構消散振動能量速度嘅臨界阻尼百分比。", "क्रांतिक अवमंदन का प्रतिशत, जो दर्शाता है कि संरचना कंपन ऊर्जा कितनी जल्दी नष्ट करती है।", "نسبة التخميد الحرج التي تمثل سرعة تبديد المنشأ لطاقة الاهتزاز."],
  ["The maximum acceptable relative horizontal displacement between adjacent floors, expressed as a percentage of story height.", "Desplazamiento horizontal relativo máximo aceptable entre pisos adyacentes, expresado como porcentaje de la altura de piso.", "Déplacement horizontal relatif maximal acceptable entre étages adjacents, exprimé en pourcentage de la hauteur d’étage.", "相鄰樓層可接受嘅最大相對水平位移，以樓層高度百分比表示。", "आसन्न मंजिलों के बीच अधिकतम स्वीकार्य सापेक्ष क्षैतिज विस्थापन, मंजिल ऊँचाई के प्रतिशत में।", "أقصى إزاحة أفقية نسبية مقبولة بين الطوابق المتجاورة كنسبة من ارتفاع الطابق."],
  ["A design coefficient representing ductility, overstrength, and energy dissipation. Higher values reduce the equivalent elastic design force.", "Coeficiente de diseño que representa ductilidad, sobrerresistencia y disipación de energía. Valores mayores reducen la fuerza elástica equivalente.", "Coefficient représentant la ductilité, la sur-résistance et la dissipation d’énergie. Une valeur élevée réduit la force élastique équivalente.", "代表延性、超強度及耗能嘅設計系數；數值越高，等效彈性設計力越低。", "नम्यता, अतिरिक्त शक्ति और ऊर्जा अपव्यय दर्शाने वाला डिज़ाइन गुणांक। अधिक मान समतुल्य प्रत्यास्थ डिज़ाइन बल घटाते हैं।", "معامل تصميم يمثل المطيلية والقوة الزائدة وتبديد الطاقة؛ وتقلل القيم الأعلى قوة التصميم المرنة المكافئة."],
  ["A multiplier that increases design demand for structures whose continued operation or occupancy is especially important.", "Multiplicador que aumenta la demanda de diseño para estructuras cuya operación u ocupación continua es especialmente importante.", "Multiplicateur augmentant la demande pour les structures dont le fonctionnement ou l’occupation continue est particulièrement important.", "對持續運作或使用特別重要嘅結構提高設計需求嘅乘數。", "उन संरचनाओं की डिज़ाइन मांग बढ़ाने वाला गुणक जिनका सतत संचालन या अधिभोग विशेष रूप से महत्वपूर्ण है।", "مضاعف يزيد الطلب التصميمي للمنشآت التي يُعد استمرار تشغيلها أو إشغالها مهمًا بصفة خاصة."],
  ["A simplified confidence factor for material condition and construction quality. Lower reliability increases estimated response and damage.", "Factor simplificado de confianza para la condición del material y la calidad constructiva. Menor confiabilidad aumenta la respuesta y el daño estimados.", "Facteur simplifié de confiance dans l’état des matériaux et la qualité de construction. Une fiabilité moindre augmente la réponse et les dommages estimés.", "材料狀況及施工質素嘅簡化可信系數；可靠度越低，估算反應同損壞越高。", "सामग्री स्थिति और निर्माण गुणवत्ता का सरल विश्वास गुणक। कम विश्वसनीयता अनुमानित प्रतिक्रिया और क्षति बढ़ाती है।", "معامل ثقة مبسط لحالة المواد وجودة التنفيذ؛ وتزيد الموثوقية المنخفضة الاستجابة والضرر المقدرين."],
  ["This report does not replace the expertise or judgment of a licensed engineer. No liability is accepted for decisions or outcomes based on generated results.", "Este informe no reemplaza la experiencia ni el criterio de un ingeniero autorizado. No se acepta responsabilidad por decisiones o resultados basados en los datos generados.", "Ce rapport ne remplace pas l’expertise ni le jugement d’un ingénieur agréé. Aucune responsabilité n’est acceptée pour les décisions fondées sur ces résultats.", "本報告不能取代持牌工程師嘅專業知識及判斷；對基於結果作出嘅決定概不負責。", "यह रिपोर्ट लाइसेंसधारी इंजीनियर की विशेषज्ञता या निर्णय का विकल्प नहीं है। परिणामों पर आधारित निर्णयों की जिम्मेदारी स्वीकार नहीं की जाती।", "لا يحل هذا التقرير محل خبرة مهندس مرخص أو حكمه المهني، ولا تُقبل مسؤولية عن القرارات المبنية على نتائجه."],
  ["Set magnitude, perceived intensity, peak amplitude, dominant frequency, and site class. Every change recalculates the response immediately.", "Define magnitud, intensidad percibida, amplitud máxima, frecuencia dominante y clase de sitio. Cada cambio recalcula la respuesta de inmediato.", "Réglez la magnitude, l’intensité ressentie, l’amplitude maximale, la fréquence dominante et la classe de site. Chaque changement recalcule immédiatement la réponse.", "設定震級、感知烈度、峰值振幅、主頻率及場地類別；每次改動都會即時計算反應。", "परिमाण, अनुभूत तीव्रता, अधिकतम आयाम, प्रमुख आवृत्ति और साइट वर्ग सेट करें। हर बदलाव तुरंत प्रतिक्रिया की पुनर्गणना करता है।", "حدد القوة والشدة المحسوسة والسعة القصوى والتردد السائد وفئة الموقع؛ ويعاد الحساب فورًا مع كل تغيير."],
  ["Choose an asset and framing system, then refine its floors, height, damping, drift limit, response coefficient, importance, and reliability.", "Elige un activo y sistema estructural; luego ajusta pisos, altura, amortiguamiento, deriva, respuesta, importancia y confiabilidad.", "Choisissez un ouvrage et son ossature, puis affinez les étages, la hauteur, l’amortissement, la dérive, la réponse, l’importance et la fiabilité.", "選擇資產及框架系統，再調整樓層、高度、阻尼、位移限值、反應、重要性及可靠度。", "परिसंपत्ति और फ्रेम प्रणाली चुनें, फिर मंजिलें, ऊँचाई, अवमंदन, ड्रिफ्ट, प्रतिक्रिया, महत्व और विश्वसनीयता समायोजित करें।", "اختر الأصل ونظام الإطار ثم اضبط الطوابق والارتفاع والتخميد والانجراف والاستجابة والأهمية والموثوقية."],
  ["Orbit and zoom the model while comparing its movement with live MMI, PGA, spectral acceleration, period, base shear, drift, and damage.", "Orbita y amplía el modelo mientras comparas su movimiento con MMI, PGA, aceleración espectral, período, cortante basal, deriva y daño en vivo.", "Faites pivoter et zoomez le modèle tout en comparant son mouvement aux valeurs MMI, PGA, accélération spectrale, période, cisaillement, dérive et dommages.", "旋轉及縮放模型，同時比較即時 MMI、PGA、譜加速度、週期、基底剪力、層間位移及損壞。", "मॉडल को घुमाएँ और ज़ूम करें तथा गति की तुलना लाइव MMI, PGA, स्पेक्ट्रल त्वरण, आवर्तकाल, आधार कतरनी, ड्रिफ्ट और क्षति से करें।", "دوّر النموذج وكبّره مع مقارنة حركته بقيم MMI وPGA والتسارع الطيفي والفترة وقص القاعدة والانجراف والضرر."],
  ["Download a report of the current inputs and outputs. Treat it as an educational summary, never as a professional engineering assessment.", "Descarga un informe de las entradas y resultados actuales. Úsalo como resumen educativo, nunca como evaluación profesional de ingeniería.", "Téléchargez un rapport des entrées et résultats actuels. Considérez-le comme un résumé pédagogique, jamais comme une évaluation d’ingénierie professionnelle.", "下載目前輸入及結果報告；只可作教育摘要，唔可以當作專業工程評估。", "वर्तमान इनपुट और परिणामों की रिपोर्ट डाउनलोड करें। इसे शैक्षिक सारांश मानें, पेशेवर इंजीनियरिंग आकलन नहीं।", "نزّل تقرير المدخلات والنتائج الحالية واعتبره ملخصًا تعليميًا لا تقييمًا هندسيًا مهنيًا."],
  ["Define the scenario, then search for a place or activate epicenter placement. Impact rings update from the complete scenario.", "Define el escenario y luego busca un lugar o activa la ubicación del epicentro. Los anillos de impacto se actualizan según el escenario completo.", "Définissez le scénario, puis recherchez un lieu ou activez le placement de l’épicentre. Les anneaux se mettent à jour selon le scénario complet.", "設定情境後搜尋地點或啟動震央定位；影響圈會按完整情境更新。", "परिदृश्य निर्धारित करें, फिर स्थान खोजें या उपरिकेंद्र निर्धारण सक्रिय करें। प्रभाव वलय पूरे परिदृश्य से अपडेट होते हैं।", "حدد السيناريو ثم ابحث عن مكان أو فعّل تحديد المركز؛ وتتحدث حلقات التأثير وفق السيناريو الكامل."],
  ["Jump to a location and center the regional scenario.", "Ve a una ubicación y centra el escenario regional.", "Accédez à un lieu et centrez le scénario régional.", "跳到指定位置並置中區域情境。", "किसी स्थान पर जाएँ और क्षेत्रीय परिदृश्य केंद्रित करें।", "انتقل إلى موقع ووسّط السيناريو الإقليمي."],
  ["Location access is used only to choose the initial area and is not stored. Activate Set epicenter, then click once on the map.", "El acceso a la ubicación solo elige el área inicial y no se almacena. Activa Definir epicentro y haz clic una vez en el mapa.", "L’accès à la position sert uniquement à choisir la zone initiale et n’est pas conservé. Activez Définir l’épicentre, puis cliquez sur la carte.", "位置權限只用嚟選擇初始區域，唔會儲存。啟動設定震央後喺地圖點一下。", "स्थान पहुँच केवल प्रारंभिक क्षेत्र चुनने के लिए है और सहेजी नहीं जाती। उपरिकेंद्र निर्धारित करें सक्रिय करके मानचित्र पर क्लिक करें।", "يُستخدم الوصول إلى الموقع لاختيار المنطقة الأولية فقط ولا يُخزّن. فعّل تحديد المركز ثم انقر مرة على الخريطة."],
  ["Results use simplified attenuation and uniform site assumptions. They are not a hazard map, emergency forecast, or substitute for official seismic, geotechnical, or engineering analysis.", "Los resultados usan atenuación simplificada y condiciones uniformes. No son un mapa de amenaza, pronóstico de emergencia ni sustituto de análisis sísmicos, geotécnicos o de ingeniería oficiales.", "Les résultats utilisent une atténuation simplifiée et un site uniforme. Ils ne constituent ni une carte d’aléa, ni une prévision d’urgence, ni un substitut à une analyse officielle.", "結果採用簡化衰減及均一場地假設，唔係災害地圖、緊急預測，亦唔可取代官方地震、岩土或工程分析。", "परिणाम सरल क्षीणन और समान साइट मान्यताओं पर आधारित हैं। ये खतरा मानचित्र, आपात पूर्वानुमान या आधिकारिक विश्लेषण का विकल्प नहीं हैं।", "تستخدم النتائج توهينًا مبسطًا وافتراضات موقع موحدة، وليست خريطة مخاطر أو توقعًا طارئًا أو بديلًا للتحليل الرسمي."],
  ["Search OpenStreetMap by city or place name, then select a result to move the epicenter and impact rings.", "Busca en OpenStreetMap por ciudad o lugar y selecciona un resultado para mover el epicentro y los anillos de impacto.", "Recherchez une ville ou un lieu sur OpenStreetMap, puis sélectionnez un résultat pour déplacer l’épicentre et les anneaux.", "喺 OpenStreetMap 搜尋城市或地點，揀選結果以移動震央同影響圈。", "OpenStreetMap पर शहर या स्थान खोजें, फिर उपरिकेंद्र और प्रभाव वलय ले जाने के लिए परिणाम चुनें।", "ابحث في OpenStreetMap باسم مدينة أو مكان، ثم اختر نتيجة لنقل المركز وحلقات التأثير."],
  ["The earthquake's logarithmic energy measure used by the regional attenuation model.", "Medida logarítmica de la energía del terremoto usada por el modelo regional de atenuación.", "Mesure logarithmique de l’énergie du séisme utilisée par le modèle régional d’atténuation.", "區域衰減模型所用嘅地震能量對數量度。", "क्षेत्रीय क्षीणन मॉडल में प्रयुक्त भूकंप ऊर्जा का लघुगणकीय माप।", "مقياس لوغاريتمي لطاقة الزلزال يستخدمه نموذج التوهين الإقليمي."],
  ["Vertical distance to the earthquake focus. Deeper events generally produce weaker surface motion nearby.", "Distancia vertical al foco sísmico. Los eventos más profundos suelen producir menor movimiento superficial cercano.", "Distance verticale au foyer du séisme. Les événements plus profonds produisent généralement moins de mouvement en surface à proximité.", "到震源嘅垂直距離；較深地震通常令附近地面震動較弱。", "भूकंप केंद्र तक ऊर्ध्वाधर दूरी। गहरी घटनाएँ पास की सतह पर सामान्यतः कम गति उत्पन्न करती हैं।", "المسافة الرأسية إلى بؤرة الزلزال؛ وتنتج الأحداث الأعمق عادةً حركة سطحية أضعف قربها."],
  ["Maximum regional distance available to the impact-ring model.", "Distancia regional máxima disponible para el modelo de anillos de impacto.", "Distance régionale maximale disponible pour le modèle des anneaux d’impact.", "影響圈模型可用嘅最大區域距離。", "प्रभाव-वलय मॉडल के लिए उपलब्ध अधिकतम क्षेत्रीय दूरी।", "أقصى مسافة إقليمية متاحة لنموذج حلقات التأثير."],
  ["Assumed soil or rock class used to amplify or reduce calculated ground motion.", "Clase de suelo o roca supuesta para amplificar o reducir el movimiento del suelo calculado.", "Classe de sol ou de roche supposée pour amplifier ou réduire le mouvement du sol calculé.", "用嚟放大或減低計算地面運動嘅假設土壤或岩石類別。", "गणना की गई भूमि गति को बढ़ाने या घटाने के लिए मानी गई मिट्टी या चट्टान श्रेणी।", "فئة التربة أو الصخر المفترضة لتضخيم حركة الأرض المحسوبة أو تقليلها."],
  ["The north–south coordinate of the modeled epicenter in decimal degrees.", "Coordenada norte-sur del epicentro modelado en grados decimales.", "Coordonnée nord-sud de l’épicentre modélisé en degrés décimaux.", "模擬震央嘅南北座標，以十進制度表示。", "मॉडल उपरिकेंद्र का उत्तर-दक्षिण निर्देशांक, दशमलव अंशों में।", "الإحداثي الشمالي الجنوبي للمركز النموذجي بالدرجات العشرية."],
  ["The east–west coordinate of the modeled epicenter in decimal degrees.", "Coordenada este-oeste del epicentro modelado en grados decimales.", "Coordonnée est-ouest de l’épicentre modélisé en degrés décimaux.", "模擬震央嘅東西座標，以十進制度表示。", "मॉडल उपरिकेंद्र का पूर्व-पश्चिम निर्देशांक, दशमलव अंशों में।", "الإحداثي الشرقي الغربي للمركز النموذجي بالدرجات العشرية."],
  ["STRUCTURAL RESPONSE REPORT", "INFORME DE RESPUESTA ESTRUCTURAL", "RAPPORT DE RÉPONSE STRUCTURELLE", "結構反應報告", "संरचनात्मक प्रतिक्रिया रिपोर्ट", "تقرير الاستجابة الإنشائية"],
  ["Generated", "Generado", "Généré", "產生日期", "निर्मित", "تاريخ الإنشاء"],
  ["MODEL CONFIGURATION", "CONFIGURACIÓN DEL MODELO", "CONFIGURATION DU MODÈLE", "模型設定", "मॉडल कॉन्फ़िगरेशन", "إعداد النموذج"],
  ["VALUE", "VALOR", "VALEUR", "數值", "मान", "القيمة"],
  ["Stories", "Pisos", "Étages", "樓層", "मंजिलें", "الطوابق"],
  ["Story / total height", "Altura de piso / total", "Hauteur d’étage / totale", "樓層／總高度", "मंजिल / कुल ऊँचाई", "ارتفاع الطابق / الكلي"],
  ["Magnitude (M)", "Magnitud (M)", "Magnitude (M)", "震級 (M)", "परिमाण (M)", "القوة (M)"],
  ["Input intensity (I)", "Intensidad de entrada (I)", "Intensité d’entrée (I)", "輸入烈度 (I)", "इनपुट तीव्रता (I)", "شدة الإدخال (I)"],
  ["Peak amplitude (A)", "Amplitud máxima (A)", "Amplitude maximale (A)", "峰值振幅 (A)", "अधिकतम आयाम (A)", "السعة القصوى (A)"],
  ["Dominant frequency (f)", "Frecuencia dominante (f)", "Fréquence dominante (f)", "主頻率 (f)", "प्रमुख आवृत्ति (f)", "التردد السائد (f)"],
  ["CALCULATED RESPONSE", "RESPUESTA CALCULADA", "RÉPONSE CALCULÉE", "計算反應", "गणना की गई प्रतिक्रिया", "الاستجابة المحسوبة"],
  ["RESULT", "RESULTADO", "RÉSULTAT", "結果", "परिणाम", "النتيجة"],
  ["Modified Mercalli Intensity", "Intensidad de Mercalli Modificada", "Intensité de Mercalli modifiée", "修訂麥加利烈度", "संशोधित मर्कैली तीव्रता", "شدة ميركالي المعدلة"],
  ["MMI meaning", "Significado de MMI", "Signification de la MMI", "MMI 意義", "MMI का अर्थ", "معنى MMI"],
  ["Peak Ground Acceleration", "Aceleración máxima del suelo", "Accélération maximale du sol", "峰值地面加速度", "अधिकतम भूमि त्वरण", "تسارع الأرض الأقصى"],
  ["Spectral Acceleration", "Aceleración espectral", "Accélération spectrale", "譜加速度", "स्पेक्ट्रल त्वरण", "التسارع الطيفي"],
  ["Fundamental Period", "Período fundamental", "Période fondamentale", "基本週期", "मूल आवर्तकाल", "الفترة الأساسية"],
  ["Interstory Drift", "Deriva entre pisos", "Dérive inter-étage", "層間位移", "अंतर-मंजिला ड्रिफ्ट", "انجراف الطوابق"],
  ["Base Shear", "Cortante basal", "Cisaillement de base", "基底剪力", "आधार कतरनी", "قص القاعدة"],
  ["Damage Index", "Índice de daño", "Indice de dommage", "損壞指數", "क्षति सूचकांक", "مؤشر الضرر"],
  ["DESIGN COEFFICIENT", "COEFICIENTE DE DISEÑO", "COEFFICIENT DE CONCEPTION", "設計系數", "डिज़ाइन गुणांक", "معامل التصميم"],
  ["Response Modification (R)", "Modificación de respuesta (R)", "Modification de réponse (R)", "反應修正 (R)", "प्रतिक्रिया संशोधन (R)", "تعديل الاستجابة (R)"],
  ["Importance Factor (Ie)", "Factor de importancia (Ie)", "Facteur d’importance (Ie)", "重要性系數 (Ie)", "महत्व गुणांक (Ie)", "معامل الأهمية (Ie)"],
  ["IMPORTANT PROFESSIONAL-USE DISCLAIMER", "AVISO IMPORTANTE DE USO PROFESIONAL", "AVERTISSEMENT IMPORTANT D’USAGE PROFESSIONNEL", "重要專業用途免責聲明", "महत्वपूर्ण पेशेवर उपयोग अस्वीकरण", "إخلاء مسؤولية مهم للاستخدام المهني"],
  ["Indicative educational model - simplified response relationships", "Modelo educativo indicativo - relaciones de respuesta simplificadas", "Modèle pédagogique indicatif - relations de réponse simplifiées", "指示性教育模型 - 簡化反應關係", "संकेतात्मक शैक्षिक मॉडल - सरल प्रतिक्रिया संबंध", "نموذج تعليمي إرشادي - علاقات استجابة مبسطة"],
  ["REGIONAL EARTHQUAKE IMPACT REPORT", "INFORME REGIONAL DE IMPACTO SÍSMICO", "RAPPORT RÉGIONAL D’IMPACT SISMIQUE", "區域地震影響報告", "क्षेत्रीय भूकंप प्रभाव रिपोर्ट", "تقرير التأثير الزلزالي الإقليمي"],
  ["Epicenter", "Epicentro", "Épicentre", "震央", "उपरिकेंद्र", "المركز السطحي"],
  ["Map data © OpenStreetMap contributors", "Datos del mapa © colaboradores de OpenStreetMap", "Données cartographiques © contributeurs OpenStreetMap", "地圖資料 © OpenStreetMap 貢獻者", "मानचित्र डेटा © OpenStreetMap योगदानकर्ता", "بيانات الخريطة © مساهمو OpenStreetMap"],
  ["Map image unavailable in this browser", "Imagen del mapa no disponible en este navegador", "Image de la carte indisponible dans ce navigateur", "此瀏覽器無法取得地圖影像", "इस ब्राउज़र में मानचित्र छवि उपलब्ध नहीं है", "صورة الخريطة غير متاحة في هذا المتصفح"],
  ["SCENARIO INPUT", "ENTRADA DEL ESCENARIO", "PARAMÈTRE DU SCÉNARIO", "情境輸入", "परिदृश्य इनपुट", "مدخلات السيناريو"],
  ["Epicenter MMI", "MMI del epicentro", "MMI à l’épicentre", "震央 MMI", "उपरिकेंद्र MMI", "MMI عند المركز"],
  ["IMPACT RING", "ANILLO DE IMPACTO", "ANNEAU D’IMPACT", "影響圈", "प्रभाव वलय", "حلقة التأثير"],
  ["MODELED RADIUS", "RADIO MODELADO", "RAYON MODÉLISÉ", "模擬半徑", "मॉडल त्रिज्या", "نصف القطر النموذجي"],
  ["Highest motion", "Movimiento mayor", "Mouvement élevé", "最高震動", "उच्चतम गति", "الحركة الأعلى"],
  ["Moderate motion", "Movimiento moderado", "Mouvement modéré", "中等震動", "मध्यम गति", "الحركة المتوسطة"],
  ["Lower motion", "Movimiento menor", "Mouvement faible", "較低震動", "निम्न गति", "الحركة الأدنى"],
  ["MODEL SCOPE & PROFESSIONAL-USE NOTICE", "ALCANCE DEL MODELO Y AVISO DE USO PROFESIONAL", "PORTÉE DU MODÈLE ET AVIS D’USAGE PROFESSIONNEL", "模型範圍及專業用途通知", "मॉडल दायरा और पेशेवर उपयोग सूचना", "نطاق النموذج وإشعار الاستخدام المهني"],
  ["Regional model limitations", "Limitaciones del modelo regional", "Limites du modèle régional", "區域模型限制", "क्षेत्रीय मॉडल की सीमाएँ", "قيود النموذج الإقليمي"],
  ["Indicative educational screening model · Not for engineering or emergency decisions", "Modelo educativo indicativo · No apto para decisiones de ingeniería o emergencia", "Modèle pédagogique indicatif · Non destiné aux décisions d’ingénierie ou d’urgence", "指示性教育篩查模型 · 不可用於工程或緊急決策", "संकेतात्मक शैक्षिक स्क्रीनिंग मॉडल · इंजीनियरिंग या आपात निर्णयों के लिए नहीं", "نموذج فحص تعليمي إرشادي · ليس لقرارات الهندسة أو الطوارئ"],
  ["This report is generated from a simplified educational simulation. It does not replace the expertise, inspection, calculations, or professional judgment of a licensed structural or civil engineer. The website and its creators accept no responsibility or liability for decisions, designs, losses, injuries, or damages based on this report. Do not use this report for construction, code compliance, emergency planning, property transactions, or life-safety decisions.", "Este informe se genera mediante una simulación educativa simplificada. No reemplaza la experiencia, inspección, cálculos ni criterio profesional de un ingeniero estructural o civil autorizado. El sitio web y sus creadores no aceptan responsabilidad por decisiones, diseños, pérdidas, lesiones o daños basados en este informe. No lo utilice para construcción, cumplimiento normativo, planificación de emergencias, transacciones inmobiliarias ni decisiones de seguridad humana.", "Ce rapport est issu d’une simulation pédagogique simplifiée. Il ne remplace ni l’expertise, ni l’inspection, ni les calculs, ni le jugement d’un ingénieur agréé. Le site et ses créateurs déclinent toute responsabilité pour les décisions, conceptions, pertes, blessures ou dommages fondés sur ce rapport. Ne l’utilisez pas pour la construction, la conformité réglementaire, la planification d’urgence, les transactions immobilières ou la sécurité des personnes.", "本報告由簡化教育模擬產生，不能取代持牌結構或土木工程師嘅專業知識、檢查、計算或判斷。網站及創作者對基於本報告嘅決定、設計、損失、傷害或損壞概不負責。請勿用於施工、法規合規、緊急規劃、物業交易或生命安全決策。", "यह रिपोर्ट सरल शैक्षिक सिमुलेशन से बनाई गई है। यह लाइसेंसधारी संरचनात्मक या सिविल इंजीनियर की विशेषज्ञता, निरीक्षण, गणना या पेशेवर निर्णय का विकल्प नहीं है। वेबसाइट और निर्माता इस रिपोर्ट पर आधारित निर्णय, डिज़ाइन, हानि, चोट या क्षति की जिम्मेदारी स्वीकार नहीं करते। निर्माण, संहिता अनुपालन, आपात योजना, संपत्ति लेनदेन या जीवन-सुरक्षा निर्णयों में इसका उपयोग न करें।", "أُنشئ هذا التقرير من محاكاة تعليمية مبسطة، ولا يحل محل خبرة مهندس إنشائي أو مدني مرخص أو فحصه أو حساباته أو حكمه المهني. لا يتحمل الموقع أو منشئوه مسؤولية القرارات أو التصاميم أو الخسائر أو الإصابات أو الأضرار المبنية عليه. لا تستخدمه للبناء أو الامتثال للكود أو التخطيط للطوارئ أو المعاملات العقارية أو قرارات سلامة الأرواح."],
  ["Impact rings use simplified attenuation, a uniform representative site class, and screening thresholds. They do not account for fault geometry, topography, basin effects, liquefaction, landslides, infrastructure condition, building inventory, or official hazard products. Location detection is used only in the browser to select an initial area.", "Los anillos de impacto usan atenuación simplificada, una clase de sitio uniforme y umbrales de evaluación. No consideran geometría de fallas, topografía, efectos de cuenca, licuefacción, deslizamientos, infraestructura, inventario de edificios ni productos oficiales de amenaza. La ubicación solo se usa en el navegador para seleccionar el área inicial.", "Les anneaux utilisent une atténuation simplifiée, une classe de site uniforme et des seuils de dépistage. Ils ne tiennent pas compte de la géométrie des failles, de la topographie, des effets de bassin, de la liquéfaction, des glissements, de l’état des infrastructures, du parc immobilier ou des produits officiels. La localisation sert uniquement à choisir la zone initiale.", "影響圈採用簡化衰減、均一代表場地類別及篩查門檻，未有考慮斷層幾何、地形、盆地效應、液化、山泥傾瀉、基建狀況、建築存量或官方災害產品。位置偵測只喺瀏覽器用嚟選擇初始區域。", "प्रभाव वलय सरल क्षीणन, समान प्रतिनिधि साइट वर्ग और स्क्रीनिंग सीमाएँ उपयोग करते हैं। इनमें भ्रंश ज्यामिति, स्थलाकृति, बेसिन प्रभाव, द्रवीकरण, भूस्खलन, अवसंरचना स्थिति, भवन सूची या आधिकारिक खतरा उत्पाद शामिल नहीं हैं। स्थान पहचान केवल प्रारंभिक क्षेत्र चुनने के लिए होती है।", "تستخدم حلقات التأثير توهينًا مبسطًا وفئة موقع موحدة وحدود فحص، ولا تراعي هندسة الصدوع أو التضاريس أو تأثيرات الأحواض أو التسييل أو الانهيارات الأرضية أو حالة البنية التحتية أو مخزون المباني أو منتجات المخاطر الرسمية. يُستخدم تحديد الموقع في المتصفح لاختيار المنطقة الأولية فقط."],
  ["Not felt", "No percibido", "Non ressenti", "無感", "महसूस नहीं हुआ", "غير محسوس"],
  ["Very weak", "Muy débil", "Très faible", "非常微弱", "बहुत कमजोर", "ضعيف جدًا"],
  ["Weak", "Débil", "Faible", "微弱", "कमजोर", "ضعيف"],
  ["Light", "Ligero", "Léger", "輕微", "हल्का", "خفيف"],
  ["Strong", "Fuerte", "Fort", "強烈", "तीव्र", "قوي"],
  ["Very strong", "Muy fuerte", "Très fort", "非常強烈", "बहुत तीव्र", "قوي جدًا"],
  ["Severe", "Severo", "Sévère", "嚴重", "गंभीर", "شديد"],
  ["Violent", "Violento", "Violent", "猛烈", "हिंसक", "عنيف"],
  ["Extreme", "Extremo", "Extrême", "極端", "चरम", "متطرف"],
];

const indices: Record<Language, number> = { en: 0, es: 1, fr: 2, yue: 3, hi: 4, ar: 5 };
const dictionaries = Object.fromEntries(LANGUAGES.map(({ code }) => [code, new Map(rows.map((row) => [row[0], row[indices[code]]]))])) as Record<Language, Map<string, string>>;
const originalText = new WeakMap<Text, string>();
const renderedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const renderedAttributes = new WeakMap<Element, Map<string, string>>();

export function translateText(text: string, language: Language) {
  if (language === "en" || !text.trim()) return text;
  const dictionary = dictionaries[language];
  const leading = text.match(/^\s*/)?.[0] ?? "";
  const trailing = text.match(/\s*$/)?.[0] ?? "";
  const core = text.trim();
  const exact = dictionary.get(core);
  if (exact) return `${leading}${exact}${trailing}`;
  let translated = core;
  const replaceable = [...dictionary.entries()].filter(([source]) => source.length >= 4).sort((a, b) => b[0].length - a[0].length);
  for (const [source, target] of replaceable) translated = translated.replaceAll(source, target);
  translated = translated.replace(/(\d+)-story/g, language === "es" ? "$1 pisos" : language === "fr" ? "$1 étages" : language === "yue" ? "$1 層" : language === "hi" ? "$1 मंजिल" : "$1 طابق");
  translated = translated.replace(/damage index/g, language === "es" ? "índice de daño" : language === "fr" ? "indice de dommage" : language === "yue" ? "損壞指數" : language === "hi" ? "क्षति सूचकांक" : "مؤشر الضرر");
  translated = translated.replace(/limit /g, language === "es" ? "límite " : language === "fr" ? "limite " : language === "yue" ? "限值 " : language === "hi" ? "सीमा " : "الحد ");
  return `${leading}${translated}${trailing}`;
}

function translateTree(root: ParentNode, language: Language) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (!node.parentElement?.closest("script, style")) {
      const current = node.nodeValue ?? "";
      const known = originalText.get(node);
      const lastRendered = renderedText.get(node);
      // React may update an existing text node after it was translated. In that
      // case, capture the new English source. A language switch, by contrast,
      // still sees the value written by this runtime and preserves its source.
      if (!known || (lastRendered !== undefined && current !== lastRendered)) originalText.set(node, current);
      const source = originalText.get(node) ?? current;
      const next = translateText(source, language);
      if (current !== next) node.nodeValue = next;
      renderedText.set(node, next);
    }
    node = walker.nextNode() as Text | null;
  }
  const elements = root instanceof Element ? [root, ...root.querySelectorAll("*")] : [...root.querySelectorAll("*")];
  for (const element of elements) {
    for (const attribute of ["aria-label", "title", "placeholder"]) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      let originals = originalAttributes.get(element);
      if (!originals) { originals = new Map(); originalAttributes.set(element, originals); }
      let rendered = renderedAttributes.get(element);
      if (!rendered) { rendered = new Map(); renderedAttributes.set(element, rendered); }
      if (!originals.has(attribute) || (rendered.has(attribute) && current !== rendered.get(attribute))) originals.set(attribute, current);
      const next = translateText(originals.get(attribute) ?? current, language);
      if (current !== next) element.setAttribute(attribute, next);
      rendered.set(attribute, next);
    }
  }
}

export function LocalizationRuntime({ language }: { language: Language }) {
  useEffect(() => {
    let active = true;
    document.documentElement.lang = language === "yue" ? "zh-HK" : language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.body.dataset.language = language;
    translateTree(document.body, language);
    const observer = new MutationObserver((mutations) => {
      if (!active) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target.parentNode) translateTree(mutation.target.parentNode, language);
        mutation.addedNodes.forEach((added) => {
          if (added.nodeType === Node.ELEMENT_NODE || added.nodeType === Node.TEXT_NODE) translateTree(added.parentNode ?? document.body, language);
        });
      }
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [language]);
  return null;
}
