const nl = {
	state: {
		button_request: 'Verleen toegang',
		initial: 'Controleren of de hub client toegang heeft tot cookies en lokale opslag...',
		requesting: 'Toegang verlenen...',
		denied: 'Sorry, de hub client kan helaas niet worden uitgevoerd zonder toegang tot cookies en lokale opslag',
		woops: 'Oeps, ik had niet verwacht in deze status te zijn.',
	},
	dialog: {
		ok: 'Ok',
		cancel: 'Annuleer',
		close: 'Sluiten',
		yes: 'Ja',
		no: 'Nee',
		submit: 'Invoeren',
		ignore: 'Negeren',
		continue: 'Verder',
		title_sure: 'Weet je het zeker?',
	},
	errors: {
		error: 'Helaas, er is een fout opgetreden. Neem contact op met de developers.\n\n {0}',
		server: 'Fout van de server',
		M_LIMIT_EXCEEDED: 'Te veel inlogpogingen achter elkaar. Probeer het over {0} seconden nog eens.',
		not_send_offline: 'Geen internet connectie. Dit bericht is niet verstuurd.',
		resend: 'Verzend opnieuw',
		file_upload: 'Bestandsformaat niet ondersteund',
		no_valid_attribute: 'Een beveilgde kamer moet attributen hebben',
		do_not_remove_attributes: 'Attributen mogen niet uit een beveiligde kamer verwijderd worden',
	},
	file: {
		file: 'Bestand',
		upload_file: 'upload bestand',
		upload_message: 'Wil je uploaden',
	},
	forms: {
		submit: 'Invoeren',
	},
	home: {
		hub_homepage_welcome: 'Welkom bij de {0}-hub!',
		hub_homepage_join: 'Doe mee met deze Hub',
		hub_homepage_welcome_auth: 'Welkom bij de {0}-hub.',
		welcome: 'Welkom',
		highlighted_hubs: 'Uitgelichte Hubs',
	},
	login: {
		login: 'Login',
		global_login: 'Login bij PubHubs',
	},
	logout: {
		logout: 'Logout',
		logout_sure: 'Weet je zeker dat je wilt uitloggen?',
	},
	menu: {
		calender: 'Kalender',
		home: 'Home',
		logout: 'Uitloggen',
		name: 'Hier komt een naam',
		private_rooms: '@:rooms.private_rooms',
		rooms: '@:rooms.rooms',
		settings: 'Instellingen',
		tool: 'Gereedschap',
		admin_tools: 'Admin tools',
		admin_tools_rooms: 'Beheer kamers',
		moderation_tools: 'Moderatietools',
		moderation_tools_disclosure: 'Vragen informatie vrij te geven',
	},
	others: {
		nop: 'Deze functionaleit is nog niet gerealiseerd.',
		search: 'Zoeken',
		search_room: 'Zoek in dit gesprek',
		search_nothing_found: 'Niets gevonden',
		read_receipt: 'Gelezen door',
		typing: 'Start typen...',
	},
	rooms: {
		room: 'Kamer:',
		me: 'Ik',
		just_you: 'Alleen jij',
		leave_sure: 'Weet je zeker dat je deze kamer wilt verlaten?',
		hide_sure: 'Weet je zeker dat je dit privé gesprek onzichtbaar wilt maken?',
		new_message: 'Typ hier je chatbericht',
		members: 'leden',
		member: 'lid',
		private_room: 'Één op één gesprek',
		private_members: 'Met ',
		private_rooms: 'Eén op één gesprekken',
		private_topic: 'Een gesprek tussen',
		private_add: 'Nieuw één op één gesprek',
		private_search_user: 'Zoek persoon',
		rooms: 'Kamers',
		join_room: 'Wordt lid van een kamer',
		add_room: 'Voeg kamer toe',
		name: 'Naam van kamer',
		name_general_room: 'Algemeen',
		name_feedback_room: 'Je feedback over PubHubs',
		filter: 'Filter kamers',
		title: '{0}',
		access_denied: 'Toegang geweigerd',
		secure_room_message_heading: 'Voordat je verder kan gaan met kamer',
		secure_room_message: 'Gebruik de Yivi app om meer gegevens te laten zien.',
		secure_room_enter_info: 'De volgende gegevens zijn nodig:',
		secured_room_error: 'Het lijkt erop dat je geen toegang hebt tot deze kamer! Controleer of je de juiste gegevens met de Yivi-app hebt laten zien.',
		admin_badge: 'Admin',
		upload_error: 'Fout tijdens uploaden',
		upload_not_allowed: 'Dit type bestand is niet toegestaan.',
		latest_news: 'Laatste nieuws',
		more_news: 'Meer nieuws',
		more_suggestions: 'Meer suggesties',
		popular_rooms: 'Populaire kamers en discussies',
		watch: 'Kijk',
		read: 'Lees',
		event: 'Evenement',
		discussion: 'Discussie',
		roomCreated: 'Kamer aangemaakt',
		discover: 'Ontdek kamers',
	},
	settings: {
		userId: 'UserID',
		displayname: 'Bijnaam',
		avatar: 'Avatar',
		displayname_changed: 'Bijnaam gewijzigd in `{0}`.',
		avatar_changed: 'Avatar bijgewerkt! ',
		theme: 'Thema',
		theme_changed: 'Thema gewijzigd in `{0}`.',
		timeformat: 'Tijd formaat',
		language: 'Taal',
		language_changed: 'Taal gewijzigd in `{0}`.',
		title: 'Instellingen',
		notifications: 'Notificaties',
		notifications_allow: 'Notificaties toestaan',
		change_avatar: 'Avatar aanpassen',
	},
	admin: {
		title: 'Admin beheer',
		description: 'Aanmaken, aanpassen en verwijderen van (beveiligde) kamers',
		add_room: 'Voeg openbaar kamer toe',
		add_secured_room: 'Voeg beveiligd kamer toe',
		name: 'Naam van kamer',
		topic: 'Omschrijving',
		public_rooms: 'Publieke Kamers',
		secured_rooms: 'Beveiligde Kamers',
		room_type: 'Type kamer',
		room_type_placeholder: 'bijvoorbeeld: ph.plugin.xxx',
		edit_name: 'Pas naam van kamer aan',
		edit_secured_room: 'Pas beveiligd kamer aan',
		added_room: 'kamer toegevoegd',
		no_rooms: 'Geen kamers',
		remove_room_sure: 'Weet je zeker dat je dit kamer wilt verwijderen?',
		secured_room: 'Beveiligde kamer',
		no_secured_rooms: 'Geen beveiligde kamers',
		secured_remove_sure: 'Weet je zeker dat je dit beveiligde kamer wilt verwijderen?',
		secured_description: 'Omschrijving van benodigde attributen',
		secured_yivi_attributes: 'Yivi Attributen',
		secured_attribute: 'Attribuut',
		secured_values: 'Waarden',
		secured_profile: 'Profiel',
		ask_disclosure_title: 'Een gebruiker vragen om informatie vrij te geven',
		ask_disclosure_choose_user: 'Een gebruiker vragen informatie vrij te geven',
		ask_disclosure_user_title: 'Gebruiker',
		ask_disclosure_where_title: 'Waar openbaar maken',
		ask_disclosure_where_room_title: 'Openbaar het aan de kamer',
		ask_disclosure_where_room_placeholder: '!room:...',
		ask_disclosure_where_public: 'een openbare kamer',
		ask_disclosure_where_private: 'aan de moderator',
		ask_disclosure_message_title: 'Bericht',
		ask_disclosure_message_placeholder: 'De volgende informatie aanvragen.',
		ask_disclosure_message_to_recipient: 'Aan {0}:\n\n{1}\n\nDe volgende informatie aanvragen: {2}',
		disclosure_sign_message: 'Aan de moderator:\n\nDe gevraagde informatie wordt openbaar gemaakt.',
		disclosure_dialog_title: 'Geef informatie vrij',
	},
	themes: {
		dark: 'Donker',
		light: 'Licht',
		system: 'Systeem',
	},
	timeformats: {
		format12: '12 uur',
		format24: '24 uur',
	},
	onboarding: {
		info_first_time: 'Dit is uw eerste bezoek. Het is leuk dat je er bent.',
		info_abt_pseudonym: 'Deze Hub heeft je een willekeurige naam gegeven(pseudonym)',
		info_issue_identity: 'Deze naam verbergt om privacyredenen je identiteit. Maar voor anderen in de Hub is het niet zo handig. Je kunt zelf een bijnaam kiezen die anderen in de Hub zien:',
		info_abt_nickname_use: 'Houd er rekening mee dat andere deelnemers ook zelfgekozen bijnamen kunnen gebruiken die niet hun echte naam hoeven te zijn.',
		info_abt_choose_later: 'Je kunt ook later een bijnaam kiezen of deze opnieuw wijzigen.',
		info_abt_yivi_room: 'Voor bepaalde kamers in deze Hub kan het zijn dat u wordt gevraagd (een deel van) uw identiteit bekend te maken, via de Yivi app. Dit geeft deelnemers in die ruimtes zekerheid over elkaar.',
		info_misbehave: 'Als je je misdraagt, kun je uiteindelijk van deze Hub worden verbannen.',
		continue: 'Doorgaan',
		success_msg: 'Je kunt de kamers verkennen en chatten met de community!',
		later: 'U heeft uw Hub-bijnaam nog niet ingesteld, wat u later kunt doen!',
		update: 'bijnaam bijgewerkt',
	},
	message: {
		send: 'Verstuur',
		in_reply_to: 'Antwoord op:',
		notification: 'Nieuw bericht in hub',
		upload_file: 'Upload bestand',
		sign: {
			add_signature: 'Onderteken bericht',
			heading: 'Een bericht ondertekenen',
			info: 'Laat zien dat je achter dit bericht staat door het te ondertekenen met jouw gegegevens.',
			warning: 'Een ondertekend bericht kan worden gedeeld. Zet er geen persoonlijke informatie in en denk aan de medegebruikers in deze kamer.',
			selected_attributes: 'Met deze informatie onderteken jij je bericht:',
			send: 'Onderteken & Verstuur',
		},
		messageSigned: {
			heading: 'Ondertekend bericht',
			info: 'Een verklaring dat ondertekend is met Yivi attributen en gedeeld kan worden buiten de Hub.',
			verificationStatus: 'Ondertekende berichten zijn nog in ontwikkeling. Ze zijn betrouwbaar, maar worden nog niet cryptographisch geverifieerd.',
		},
	},
	time: {
		today: 'Vandaag',
		yesterday: 'Gisteren',
		daysago: '{0} dagen geleden',
	},
	emoji: {
		clock: 'Alles',
		smiley: 'Smileys & Mensen',
		bear: 'Dieren & Natuur',
		cup: 'Eten & Drinken',
		basketball: 'Reizen & Plaatsen',
		house: 'Activiteiten',
		lightbulb: 'Levensstijl',
		signs: 'Symbolen',
		flag: 'Vlaggen',
	},
	validation: {
		required: '`{0}` is een verplicht veld.',
		max_length: '`{0}` is te lang, maximale lengte is {1} karakters.',
		min_length: '`{0}` is te kort, minimale lengte is {1} karakters.',
	},
};

export { nl };
