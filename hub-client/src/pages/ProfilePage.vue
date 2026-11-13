<template>
	<HeaderFooter data-testid="profile-page">
		<template #header>
			<div
				class="flex h-full items-center gap-150"
				:class="isMobile ? 'p-150 pl-700' : 'p-200 pl-400'"
			>
				<Icon type="user-circle" />
				<H3 class="text-on-surface flex">
					<TruncatedText class="font-headings font-semibold">{{ $t('settings.profile_title') }}</TruncatedText>
				</H3>
			</div>
		</template>

		<div class="flex max-w-7000 flex-col gap-400 px-400 py-200 pb-800">
			<form
				class="flex flex-col gap-400"
				@submit.prevent="submit"
			>
				<!-- Avatar -->
				<div class="flex flex-col gap-100">
					<Label>{{ $t('settings.avatar') }}</Label>
					<div class="flex items-center gap-200">
						<input
							ref="fileInput"
							accept="image/png, image/jpeg, image/svg"
							class="hidden"
							type="file"
							@change="onFileChosen"
						/>
						<button
							:aria-label="$t('settings.change_avatar')"
							class="group relative cursor-pointer rounded-full focus-visible:outline-3 focus-visible:outline-offset-2"
							data-testid="change-avatar"
							:title="$t('settings.change_avatar')"
							type="button"
							@click="fileInput?.click()"
						>
							<Avatar
								:avatar-url="previewUrl"
								class="outline-surface-elevated h-800 w-800 outline-3 transition-opacity group-hover:opacity-80"
							/>
							<span
								class="bg-accent-primary text-on-accent-primary outline-background group-hover:bg-accent-blue-interactive -right-050 -bottom-050 absolute flex h-300 w-300 items-center justify-center rounded-full outline-2"
							>
								<Icon
									size="sm"
									type="pencil-simple"
								/>
							</span>
						</button>
						<IconButton
							:aria-label="$t('settings.remove_avatar')"
							data-testid="remove-avatar"
							icon="trash"
							:title="$t('settings.remove_avatar')"
							variant="error"
							@click="removeAvatar"
						/>
					</div>
				</div>

				<!-- Display name -->
				<TextField
					v-model.trim="formState.data.displayName.value as string"
					data-testid="change-displayname"
					name="displayname"
					:placeholder="$t('settings.displayname')"
					show-length
					:validation="{ minLength: 3, maxLength: settings.getDisplayNameMaxLength }"
				>
					{{ $t('settings.displayname') }}
				</TextField>

				<!-- User id -->
				<div class="flex flex-col gap-100">
					<Label>{{ $t('settings.userId') }}</Label>
					<p
						class="text-on-surface-dim text-body break-all italic"
						:title="$t('settings.userId_description')"
					>
						{{ user.userId }}
					</p>
				</div>

				<p
					v-if="formState.message.value"
					class="bg-accent-green text-on-accent-green rounded-base p-150"
					role="status"
				>
					{{ formState.message.value }}
				</p>

				<div class="flex justify-end">
					<Button
						:disabled="disabled"
						type="submit"
						>{{ $t('hub_settings.save') }}</Button
					>
				</div>
			</form>

			<div class="border-on-surface-disabled/25 border-t-2 pt-400">
				<Button
					data-testid="deactivate-account"
					icon="user-circle-minus"
					variant="secondary"
					@click="router.push({ name: 'delete-hub-account' })"
				>
					{{ $t('settings.go_to_deactivate_account_page') }}
				</Button>
			</div>
		</div>
	</HeaderFooter>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref } from 'vue';
	import { useRouter } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import IconButton from '@hub-client/components/elements/IconButton.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import Label from '@hub-client/components/forms/elements/Label.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';

	// Composables
	import { useProfile } from '@hub-client/composables/profile.composable';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const user = useUser();
	const settings = useSettings();
	const router = useRouter();
	const { formState, previewUrl, disabled, submit, chooseAvatar, removeAvatar } = useProfile();

	const isMobile = computed(() => settings.isMobileState);

	const fileInput = ref<HTMLInputElement>();

	function onFileChosen(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		chooseAvatar(input.files?.[0]);
		input.value = '';
	}
</script>
