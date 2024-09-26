const en = {
	state: {
		button_request: 'Request access',
		initial: 'Checking whether hub client has access to cookies and local storage...',
		requesting: 'Requesting access...',
		denied: 'Sorry, the hub client cannot run without access to local storage',
		woops: 'Woops, I did not expect to find myself in this state.',
	},
	dialog: {
		ok: 'Ok',
		cancel: 'Cancel',
		close: 'Close',
		yes: 'Yes',
		no: 'No',
		submit: 'Submit',
		ignore: 'Ignore',
		continue: 'Continue',
		title_sure: 'Are you sure?',
		go_back: 'Go back',
	},
	errors: {
		oops: 'Oops!',
		error: 'Unfortunately an error occured. Please contact the developers.\n\n {0}',
		server: 'Server error',
		M_LIMIT_EXCEEDED: 'Too much login attempts. Try again in {0} seconds.',
		not_send_offline: 'Internet connection seems down. This message was not send.',
		resend: 'Send again',
		file_upload: 'File format not supported',
		no_valid_attribute: 'A secured room needs to have attributes',
		do_not_remove_attributes: 'Attributes may not be removed from a secured room',
		cant_find_room: 'This room is not available at the moment',
	},
	file: {
		file: 'File',
		upload_file: 'Upload File',
		upload_message: 'Do you want to upload',
	},
	forms: {
		submit: 'Submit',
	},
	home: {
		hub_homepage_welcome: 'Welcome to the {0}-hub!',
		hub_homepage_join: 'Join this Hub',
		hub_homepage_welcome_auth: 'Welcome to the {0}-hub.',
		welcome: 'Welcome',
		highlighted_hubs: 'Highlighted Hubs',
		// Boven highlighted Hubs, iets afstand
		highlighted_hubs_info: 'PubHubs consist of seperate Hubs, where local conversations happen, under a central login. These Hubs are run by seperate, participating organisations.',
	},
	register: {
		register: 'Register',
		register_with: 'Register with',
		welcome: 'Welcome, join Pubhubs!',
		use_yivi: 'To register, you will use the Yivi app\n(and for logging in as well, by the way).',
		start_registration: 'You start registering here, in 3 steps.',
		overview_step1: "Download the Yivi app — if you don't already have it",
		overview_step2: 'Add your data to the Yivi app',
		overview_step3: 'Scan the QR code with the Yivi app',
		yivi_downloaded: 'Do you already have the Yivi app?',
		yivi_no: "No \xa0\xa0I don't have the Yivi app",
		yivi_yes: 'Yes \xa0\xa0I have the Yivi app',
		skip_step1: 'Skip step 1',
		step: 'Step {0}',
		step_go_to: 'Go to step {0}',
		step_previous: 'Back to the previous step',
		install_yivi: 'Install the Yivi app.',
		yivi_what: 'What is Yivi?',
		yivi_short_description: 'An app that allows you to easily and securely prove who you are.',
		yivi_download: 'Download the Yivi app using one of the black buttons and follow the instructions in the app.',
		yivi_installed: 'I have installed the Yivi app now',
		more: 'Want to know more?',
		yivi_workings: 'How does Yivi work?',
		yivi_workings_answer:
			'Yivi is an app for your digital identity. You can use Yivi to share personal data about yourself, such as your name, address, age, phone number and email address. You share only the data that is necessary in a particular situation. You can use Yivi to log into several websites and make yourself known there.\n\nTo use Yivi, you first have to add data about yourself in the app. It is explained in the app how to do this. For more information, see the website {hyperlink}. To use Yivi for PubHubs, you have to add an email address and phone number in the app.',
		yivi_why: 'Why Yivi for PubHubs?',
		yivi_why_answer:
			'Within PubHubs, Yivi is used for two things. {reasons} Yivi, like PubHubs, is privacy-friendly and open about how it works, via open-source software. Yivi is a separate app used by PubHubs, but not part of PubHubs. Yivi is also used on other websites for logging in.',
		yivi_why_central_login: 'For central login. You then share your email address and your mobile number. Those data are only known at the central login and not in the different Hubs you visit. Your data is not shared with others.',
		yivi_why_room_login:
			'To log in to some Rooms, where more information is requested about the participants. This may happen, for example, in a Room for people in your neighborhood, where you must first prove what your zip code is to get in. You may also have to prove that your email address is on a list for a particular Room before you can get in.',
		yivi_link: 'https://yivi.app/en/',
		data_request: 'PubHubs asks for an email address and mobile number, just for registration.',
		data_add: 'Add your email address and mobile number in the Yivi app.',
		data_add_how: 'How do I add this data?',
		data_add_how_answer:
			'There is a button in the Yivi app that allows you to collect personal information and save it in the app. For PubHubs, you need to add an email address and a mobile number in your Yivi app. You can add multiple email addresses and phone numbers. You can then choose which one you wish to use to sign in to PubHubs.\n\nThis way, if you like, you can have two different accounts for PubHubs: a private account, with your private email and mobile number, and one for work, with your work email and number.',
		data_why: 'Why does PubHubs need my email and number?',
		data_why_answer:
			'PubHubs uses the combination of your email and mobile number to recognize you. This data is not used to contact you. If you have a new phone, you will need to sign up with PubHubs again. In that case, when signing up, use your email address and mobile number that you used to log in previously. Then PubHubs will recognize you and you can continue your previous conversations.',
		data_added: 'I have now added this data',
		data_share: 'Share your email and mobile number in the app',
		add_registration: 'Add your PubHubs registration in the app',
		rewards: {
			good_job: 'Good job!',
			almost_done: "Great, you're almost done!",
			hooray: 'Hooray! {0} You are registered and logged in to PubHubs.\nYou will be redirected to an overview of Hubs automatically. Have fun!',
		},
	},
	login: {
		login: 'Login',
		global_login: 'Login to PubHubs',
	},
	logout: {
		logout: 'Logout',
		logout_sure: 'Are you sure you want to logout?',
	},
	menu: {
		calender: 'Calender',
		home: 'Home',
		logout: 'Logout',
		name: 'Here will be a name',
		private_rooms: '@:rooms.private_rooms',
		rooms: '@:rooms.rooms',
		settings: 'Settings',
		tool: 'Tool',
		admin_tools: 'Admin tools',
		admin_tools_rooms: 'Manage rooms',
		moderation_tools: 'Moderation tools',
		moderation_tools_disclosure: 'Request disclosure',
	},
	others: {
		nop: 'This feature is not implement yet.',
		search: 'Search',
		search_room: 'Search this room',
		search_nothing_found: 'Nothing found',
		read_receipt: 'Read by',
		typing: 'Start typing...',
		load_more_results: 'Load more results',
	},
	rooms: {
		room: 'Room:',
		me: 'Me',
		just_you: 'Just you',
		leave_sure: 'Do you really want to leave this room?',
		hide_sure: 'Do you really want to hide this private room?',
		new_message: 'Type your message here',
		members: 'members',
		member: 'member',
		private_room: 'One on one room',
		private_members: 'With ',
		private_rooms: 'One on one rooms',
		private_topic: 'A conversation between',
		private_add: 'New conversation',
		private_search_user: 'Search person',
		rooms: 'Rooms',
		join_room: 'Join a room',
		add_room: 'Add a room',
		name: 'Name of a room',
		name_general_room: 'General',
		name_feedback_room: 'Your feedback about PubHubs',
		filter: 'Filter rooms',
		title: '{0}',
		access_denied: 'Access Denied',
		secure_room_message_heading: 'Before you can enter room',
		secure_room_message: 'You need to show some more data from your Yivi app.',
		secure_room_enter_info: 'Please show the following:',
		secured_room_error: 'We are sorry, but it seems like you cannot access the room! Please check you gave the correct data with the Yivi App.',
		admin_badge: 'Admin',
		upload_error: 'Error while uploading',
		upload_not_allowed: 'This file type is not allowed.',
		latest_news: 'Latest news',
		more_news: 'More news',
		more_suggestions: 'More suggestions',
		popular_rooms: 'Popular rooms and discussions',
		watch: 'Watch',
		read: 'Read',
		event: 'Event',
		discussion: 'Discussion',
		roomCreated: 'Room created',
		discover: 'Discover rooms',
	},
	settings: {
		displayname: 'Nickname',
		userId: 'UserID',
		avatar: 'Avatar',
		avatar_changed: 'Avatar updated!.',
		displayname_changed: 'Nickname changed to `{0}`.',
		theme: 'Theme',
		theme_changed: 'Theme changed to `{0}`.',
		timeformat: 'Time format',
		language: 'Language',
		language_changed: 'Language changed to `{0}`.',
		title: 'Settings',
		notifications: 'Notifications',
		notifications_allow: 'Allow notifications',
		change_avatar: 'Change Avatar',
	},
	admin: {
		title: 'Admin tools',
		description: 'Create, edit, and delete (secured) rooms',
		add_room: 'Add a public room',
		add_secured_room: 'Add a (secured) room',
		name: 'Room name',
		topic: 'Description',
		public_rooms: 'Public Rooms',
		secured_rooms: 'Secured Rooms',
		room_type: 'Room type',
		room_type_placeholder: 'example: ph.plugin.xxx',
		edit_name: 'Change room name',
		edit_secured_room: 'Change secured room',
		added_room: 'Room added',
		no_rooms: 'No rooms',
		remove_room_sure: 'Are you sure to delete this public room?',
		secured_room: 'Secured room',
		no_secured_rooms: 'No secured rooms',
		secured_remove_sure: 'Are you sure to delete this secured room?',
		secured_description: 'Description of attributes needed',
		secured_yivi_attributes: 'Yivi Attributes',
		secured_attribute: 'Attribute',
		secured_values: 'Values',
		secured_profile: 'Profile',
		ask_disclosure_title: 'Ask a user to disclose information',
		ask_disclosure_choose_user: 'Ask a user to disclose information',
		ask_disclosure_user_title: 'User',
		ask_disclosure_where_title: 'Disclose to',
		ask_disclosure_where_room_title: 'Disclose to room',
		ask_disclosure_where_room_placeholder: '!room:...',
		ask_disclosure_where_public: 'a public room',
		ask_disclosure_where_private: 'the moderator',
		ask_disclosure_message_title: 'Message',
		ask_disclosure_message_placeholder: 'Please disclose the following information',
		ask_disclosure_message_to_recipient: 'To {0}:\n\n{1}\n\nThe following information is requested: {2}',
		disclosure_sign_message: 'To the moderator:\n\nThe requested information is disclosed.',
		disclosure_dialog_title: 'Please disclose information',
	},
	themes: {
		dark: 'Dark',
		light: 'Light',
		system: 'System',
	},
	timeformats: {
		format12: '12 hours',
		format24: '24 hours',
	},
	onboarding: {
		info_first_time: 'This is your first visit. It is nice that you are here.',
		info_abt_pseudonym: 'This Hub has given you a random name (pseudonym)',
		info_issue_identity: 'This name hides your identity for privacy reasons. But it is not very convenient for others in the Hub. Therefore, You can choose a nickname yourself that others in the Hub will see',
		info_abt_nickname_use: 'Please note that other participants may also use self-chosen nicknames that need not be their real names.',
		info_abt_choose_later: 'You can also choose a nickname later, or change it again.',
		info_abt_yivi_room: 'For certain rooms in this Hub, you may be asked to reveal (part of) your identity, via the Yivi app. This gives participants in those rooms certainty about each other.',
		info_misbehave: 'When you misbhehave, you may ultimately be banned from this Hub.',
		continue: 'Continue',
		success_msg: 'You can explore the rooms and chat with the community!',
		later: "You haven't set your Hub nickname, which you can do later!",
		update: 'Nickname updated',
	},
	message: {
		send: 'Send',
		in_reply_to: 'In reply to:',
		notification: 'New message in hub',
		upload_file: 'Upload file',
		sign: {
			add_signature: 'Sign message',
			heading: 'Signing a message',
			info: "Go 'on the record' by signing your message with your information.",
			warning: 'A signed message can be shared. Do not include personal information and consider other users in this room.',
			selected_attributes: 'Your message will be signed with this information:',
			send: 'Sign & Send',
		},
		messageSigned: {
			heading: 'Signed message',
			info: 'A statement that is signed with Yivi attributes and can be shared outside the Hub.',
			verificationStatus: 'Signed messages are a work in progress. They are trustworthy, but are not yet cryptographically verified.',
		},
	},
	time: {
		today: 'Today',
		yesterday: 'Yesterday',
		daysago: '{0} days ago',
	},
	emoji: {
		clock: 'All',
		smiley: 'Smileys & People',
		bear: 'Animals & Nature',
		cup: 'Food & Drink',
		basketball: 'Travel & Places',
		house: 'Activities',
		lightbulb: 'Lifestyle',
		signs: 'Symbols',
		flag: 'Flags',
	},
	validation: {
		required: '`{0}` is required.',
		max_length: '`{0}` is too long, max length is {1} characters.',
		min_length: '`{0}` is too short, min length is {1} characters.',
	},
};

export { en };
