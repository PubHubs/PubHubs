// Packages
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// Composables
import { avatarUpload } from '@hub-client/composables/fileUpload';
import { useFormState } from '@hub-client/composables/useFormState';

// Logic
import { BlobManager } from '@hub-client/logic/core/blobManager';

// Stores
import { useDialog } from '@hub-client/stores/dialog';
import { useSettings } from '@hub-client/stores/settings';
import { useUser } from '@hub-client/stores/user';

/**
 * The current user's profile form: display name and avatar, saved together on submit.
 */
export function useProfile() {
	const { t } = useI18n();
	const user = useUser();
	const settings = useSettings();
	const dialog = useDialog();
	const formState = useFormState();

	const fileInfo = ref<File>();
	const avatarChanged = ref(false);
	const avatarMxcUrl = ref<string | undefined>(undefined);
	// Only for the chosen file. The current avatar is the user store's blob, which posts and the sidebar still show, so the page must not revoke it.
	const blobUrl = ref<BlobManager>();
	const avatarRemoved = ref(false);

	// Follows the store, so an avatar that is still loading (or replaced by a sync) shows here too.
	const previewUrl = computed(() => blobUrl.value?.url ?? (avatarRemoved.value ? undefined : user.userAvatar(user.userId ?? '')));

	const disabled = computed(() => {
		const nameChanged = formState.changed.value;
		// submit() bails on an invalid name, so don't offer the button then either
		if (nameChanged && !formState.validated.value) return true;
		return !nameChanged && !avatarChanged.value;
	});

	setDisplayNameData(user.userDisplayName(user.userId ?? '') ?? '');

	onMounted(() => {
		formState.data.displayName.value = user.userDisplayName(user.userId ?? '') ?? '';
	});

	onBeforeUnmount(() => {
		blobUrl.value?.revoke();
	});

	watch(
		() => formState.data.displayName.value,
		(newValue) => {
			formState.updateData('displayName', newValue);
		},
	);

	async function submit() {
		if (formState.dataIsChanged('displayName')) {
			const newDisplayName = formState.data.displayName.value as string;
			if (newDisplayName.length > 0 && !formState.isValidated()) return;
			await user.setDisplayName(newDisplayName);
			formState.setMessage(t('settings.displayname_changed', [newDisplayName]));
			// Resets the baseline, so the button disables again until the next change
			setDisplayNameData(newDisplayName);
		}
		if (fileInfo.value) {
			await uploadAvatar();
		} else if (avatarMxcUrl.value !== undefined) {
			user.setAvatarUrl(avatarMxcUrl.value);
		}
		// The page stays mounted after saving, so clear what was saved or the next save would set the avatar again
		avatarMxcUrl.value = undefined;
		avatarChanged.value = false;
	}

	function setDisplayNameData(displayName: string) {
		formState.setData({
			displayName: {
				value: displayName,
				validation: {
					min_length: 3,
					max_length: settings.getDisplayNameMaxLength,
					allow_empty_text: true,
					allow_empty_number: true,
					allow_empty_object: true,
				},
			},
		});
	}

	/**
	 * Shows the chosen file as the avatar; it is only uploaded on submit.
	 *
	 * @param file the file picked by the user, undefined when the picker was cancelled
	 */
	function chooseAvatar(file: File | undefined) {
		if (file) {
			fileInfo.value = file;
			blobUrl.value?.revoke();
			blobUrl.value = new BlobManager(file);
			avatarChanged.value = true;
		}
	}

	async function uploadAvatar() {
		if (!fileInfo.value) return;

		await avatarUpload(
			fileInfo.value,
			async (mxUrl) => {
				if (mxUrl) user.setAvatarUrl(mxUrl);
				fileInfo.value = undefined;
			},
			(error) => {
				fileInfo.value = undefined;
				dialog.confirm(t('errors.file_upload_failed'), t(error.key, error.params));
			},
		);
	}

	function removeAvatar() {
		avatarMxcUrl.value = '';
		blobUrl.value?.revoke();
		blobUrl.value = undefined;
		avatarRemoved.value = true;
		fileInfo.value = undefined;
		avatarChanged.value = true;
	}

	return {
		formState,
		previewUrl,
		disabled,
		submit,
		chooseAvatar,
		removeAvatar,
	};
}
