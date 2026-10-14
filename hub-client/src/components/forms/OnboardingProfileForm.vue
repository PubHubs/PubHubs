<template>
	<div class="flex flex-col gap-300">
		<!-- Username Input -->
		<div class="flex flex-col gap-100">
			<H2>{{ t('onboarding.username_label') }}</H2>
			<P>{{ t('onboarding.username_description') }}</P>
			<div class="flex gap-200">
				<TextField
					v-model="displayName"
					class="placeholder-on-surface-dim! text-label"
					:help="pseudonym ? t('onboarding.keep_pseudonym', [pseudonym]) : ''"
					:validation="nameValidation"
					:placeholder="pseudonym"
					@keydown.enter="emit('submit')"
				>
					<!-- The heading above already names the field visually -->
					<span class="sr-only">{{ t('settings.displayname') }}</span>
				</TextField>
				<Button
					:aria-label="t('onboarding.username_change_avatar')"
					icon="image-square"
					:title="t('onboarding.username_change_avatar')"
					@click="fileInput!.click()"
				/>
				<input
					ref="fileInput"
					accept="image/png, image/jpeg, image/svg"
					class="hidden"
					type="file"
					@change="handleFileUpload"
				/>
			</div>
			<p class="text-on-surface italic">
				{{ t('onboarding.username_disclaimer') }}
			</p>
		</div>

		<!-- Message Preview -->
		<div
			v-if="displayName.trim() || avatarFile"
			class="flex flex-col gap-100"
		>
			<P>{{ t('onboarding.message_example') }}</P>
			<div class="bg-background flex w-full items-center gap-300 rounded-xl p-200">
				<div
					class="flex aspect-square h-600 w-600 shrink-0 items-center justify-center overflow-hidden rounded-full"
					:class="textColor(color(user.userId!))"
				>
					<img
						v-if="avatarPreview?.url"
						class="h-full w-full"
						data-testid="avatar"
						:src="avatarPreview.url"
					/>
					<Icon
						v-else
						type="user"
					/>
				</div>
				<div class="flex min-w-0 flex-col gap-100">
					<div class="flex items-center gap-100">
						<span
							:class="`${textColor(color(user.userId!))} text-label min-w-0 truncate font-semibold`"
							data-testid="display-name"
						>
							{{ displayName.trim() || pseudonym }}
						</span>
						<span class="text-label-small">|</span>
						<span class="text-label-small">{{ time }}</span>
					</div>
					<P>{{ t('onboarding.message_example_text') }}</P>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { onBeforeUnmount, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import P from '@hub-client/components/elements/P.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';

	// Composables
	import { useUserColor } from '@hub-client/composables/useUserColor';
	import { validateMessageFunctions } from '@hub-client/composables/validation.composable';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	defineProps<{
		pseudonym?: string;
	}>();

	const emit = defineEmits<{
		submit: [];
	}>();

	const displayName = defineModel<string>({ default: '' });
	const avatarFile = defineModel<File | null>('avatarFile', { default: null });

	const { t } = useI18n();
	const user = useUser();
	const settings = useSettings();
	const { color, textColor } = useUserColor();

	// The shared minLength rule rejects an empty value, but here empty means keeping the pseudonym
	const nameValidation = {
		custom: {
			validator: (value: unknown, min: unknown) => {
				const name = String(value ?? '').trim();
				return name === '' || name.length >= (min as number);
			},
			args: [3],
			message: validateMessageFunctions.minLength,
		},
		maxLength: settings.getDisplayNameMaxLength,
	};

	// Avatar handling
	const fileInput = ref<HTMLInputElement | null>(null);
	const avatarPreview = ref<BlobManager | null>(null);

	const handleFileUpload = (event: Event) => {
		const file = (event.target as HTMLInputElement)?.files?.[0];
		if (file) {
			avatarFile.value = file;
		}
	};

	// Immediate, so the preview comes back when the form is shown again with a file already chosen
	watch(
		avatarFile,
		(file) => {
			avatarPreview.value?.revoke();
			avatarPreview.value = file ? new BlobManager(file) : null;
		},
		{ immediate: true },
	);

	// TODO: move to a utility folder
	const now = new Date();
	const time = now.toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});

	// Lifecycle
	onBeforeUnmount(() => {
		avatarPreview.value?.revoke();
	});
</script>
