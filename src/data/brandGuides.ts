export interface BrandGuide {
  id: string;
  name: string;
  logo: string;
  steps: string[];
  buildRowName: string;
  menuPath: string;
  notes: string;
  troubleshooting: string[];
}

export const brandGuides: BrandGuide[] = [
  {
    id: 'samsung',
    name: 'Samsung Galaxy (One UI)',
    logo: 'SAMSUNG',
    buildRowName: 'Numéro de version (Build number)',
    menuPath: 'Paramètres → À propos du téléphone → Informations sur le logiciel → Numéro de version',
    steps: [
      'Ouvrez les Paramètres de votre Samsung.',
      'Faites défiler vers le bas et touchez « À propos du téléphone ».',
      'Appuyez sur « Informations sur le logiciel ».',
      'Tapez 7 fois consécutives et rapidement sur « Numéro de version ».',
      'Entrez votre code PIN / schéma de verrouillage lorsque demandé.',
      'Le message « Le mode développeur a été activé ! » s’affiche en bas.',
      'Revenez aux Paramètres principaux : le menu « Options de développement » apparaît tout en bas.',
      'Activez « Débogage USB ».'
    ],
    notes: 'Sur les modèles Samsung récents avec Knox actif, l’écran demandera le code PIN de sécurité avant d’accorder le statut développeur.',
    troubleshooting: [
      'Si le câble USB ne déclenche aucune réaction, vérifiez que le pilote Samsung USB Driver for Mobile Phones est installé.',
      'Sur l’écran de votre téléphone, acceptez la popup « Toujours autoriser le débogage USB depuis cet ordinateur » en cochant la case.'
    ]
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi / Redmi / POCO (HyperOS / MIUI)',
    logo: 'XIAOMI',
    buildRowName: 'Version de l’OS / Version MIUI',
    menuPath: 'Paramètres → À propos de l’appareil → Version de l’OS / Version MIUI',
    steps: [
      'Ouvrez les Paramètres de votre Xiaomi.',
      'Appuyez sur « À propos de l’appareil » (tout en haut).',
      'Tapez 7 fois de suite sur la ligne « Version de l’OS » (ou « Version MIUI »).',
      'Un message toast apparaît : « Vous êtes désormais un développeur ! »',
      'Revenez en arrière puis allez dans « Paramètres supplémentaires » → « Options développeur ».',
      'Activez « Débogage USB ».',
      'IMPORTANT (Spécifique Xiaomi) : Activez également « Débogage USB (paramètres de sécurité) » si vous souhaitez autoriser les modifications de permissions.'
    ],
    notes: 'Sur Xiaomi/HyperOS, l’activation de certains paramètres avancés de débogage requiert d’être connecté à un compte Mi avec carte SIM insérée.',
    troubleshooting: [
      'Désactivez l’« Optimisation MIUI » si des installations APK par ADB échouent.',
      'Confirmez les 3 avertissements de sécurité consécutifs de 5 secondes imposés par Xiaomi.'
    ]
  },
  {
    id: 'pixel',
    name: 'Google Pixel / Android Stock',
    logo: 'GOOGLE',
    buildRowName: 'Numéro de build',
    menuPath: 'Paramètres → À propos du téléphone → (Bas de page) Numéro de build',
    steps: [
      'Ouvrez l’application Paramètres.',
      'Descendez tout en bas et appuyez sur « À propos du téléphone ».',
      'Faites défiler jusqu’à la dernière ligne « Numéro de build ».',
      'Tapez 7 fois rapidement sur « Numéro de build ».',
      'Saisissez votre code PIN si configuré.',
      'Le toast « Vous êtes maintenant un développeur ! » s’affiche.',
      'Revenez dans Paramètres → « Système » → « Options pour les développeurs ».',
      'Activez l’interrupteur « Débogage USB ».'
    ],
    notes: 'Sur Android 14 et 15 stock, les options développeur sont rangées à l’intérieur du sous-menu Système.',
    troubleshooting: [
      'Vérifiez la notification USB de notification Android et sélectionnez « Transfert de fichiers » ou « Chargement uniquement ».'
    ]
  },
  {
    id: 'oppo',
    name: 'Oppo / Realme / OnePlus (ColorOS / OxygenOS)',
    logo: 'OPPO',
    buildRowName: 'Numéro de version',
    menuPath: 'Paramètres → À propos de l’appareil → Version → Numéro de version',
    steps: [
      'Allez dans Paramètres.',
      'Appuyez sur « À propos de l’appareil ».',
      'Sélectionnez la sous-section « Version » (ou « Bande de base et noyau »).',
      'Tapez 7 fois consécutivement sur « Numéro de version ».',
      'Saisissez votre mot de passe de verrouillage.',
      'Revenez en arrière → Paramètres système (ou Paramètres supplémentaires) → « Options pour les développeurs ».',
      'Cochez « Débogage USB ».'
    ],
    notes: 'ColorOS dispose d’un interrupteur de désactivation automatique du débogage USB au bout de 10 minutes d’inactivité sur certains modèles.',
    troubleshooting: [
      'Désactivez « Désactivation automatique du débogage USB » dans les options développeur.'
    ]
  },
  {
    id: 'huawei',
    name: 'Huawei / Honor (EMUI / MagicOS)',
    logo: 'HUAWEI',
    buildRowName: 'Numéro de build',
    menuPath: 'Paramètres → À propos du téléphone → Numéro de build',
    steps: [
      'Entrez dans les Paramètres.',
      'Rendez-vous dans « À propos du téléphone ».',
      'Tapez 7 fois d’affilée sur « Numéro de build ».',
      'Confirmez le code de déverrouillage de l’écran.',
      'Revenez au menu principal → « Système et mises à jour » → « Options pour développeurs ».',
      'Activez « Débogage USB » et autorisez la connexion HDB si demandée.'
    ],
    notes: 'Huawei utilise parfois son propre protocole propriétaire « HDB » (HiSuite) en parallèle d’ADB.',
    troubleshooting: [
      'Activez également « Toujours inviter lors de la connexion à USB » pour choisir le mode adéquat.'
    ]
  },
  {
    id: 'motorola',
    name: 'Motorola (Moto UX)',
    logo: 'MOTOROLA',
    buildRowName: 'Numéro de build',
    menuPath: 'Paramètres → À propos du téléphone → Numéro de build',
    steps: [
      'Ouvrez les Paramètres.',
      'Touchez « À propos du téléphone ».',
      'Tapez 7 fois sur « Numéro de build ».',
      'Allez dans Système → « Options pour les développeurs ».',
      'Activez le Débogage USB.'
    ],
    notes: 'L’interface Motorola est très proche d’Android pur AOSP.',
    troubleshooting: [
      'Utilisez un câble USB officiel Motorola ou certifié charge rapide + data.'
    ]
  }
];
