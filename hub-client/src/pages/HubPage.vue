<template>
<div class="h-full flex flex-col">
    <div class="p-5 h-28 items-center bg-cover bg-center bg-gradient-to-t from-blue-light via-avatar-blue to-blue">
        <H1><template></template>Radboud hubpage</H1>
    </div>

    <div class="flex items-start h-full">
        <div class="flex justify-center flex-col p-12 w-1/3 h-full ">
            <H2>Over de Radboud Hub</H2>
            <p class="my-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lectus fermentum diam, mi blandit ornare quam eu dolor.
                Neque, risus ut eget sit sit neque eu in. Nibh sociis eu sapien augue. Integer proin interdum lacus, ornare quam
                facilisi.
            </p>
            <p class="my-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lectus fermentum diam, mi blandit ornare quam eu dolor.
                Neque, risus ut eget sit sit neque eu in. Nibh sociis eu sapien augue. Integer proin interdum lacus, ornare quam
                facilisi.
            </p>
            <Button @click="login()">Doe mee met Radboud hub!</Button>
        </div>

        <div class="flex flex-col w-2/3 p-4 h-full">
            <div class="flex flex-col h-1/3">
                <H2 class="mb-5 mt-12">Uitgelichte rooms van de voorbeeldhub</H2>
                <div class="flex justify-between h-full gap-4">
                    <ArticleBlock>
                        <template #image></template>
                        <template #header>Tech nieuws</template>
                        <template #category>Room</template>
                        <template #content>Gesprekken over het laatste tech gerelateerde nieuws.</template>
                    </ArticleBlock>
                  
                    <ArticleBlock>
                        <template #image></template>
                        <template #header>Smartphones en jonge kinderen</template>
                        <template #category>Room</template>
                        <template #content>Gesprekken over hoe om te gaan met smartphones en jonge kinderen.</template>
                    </ArticleBlock>
                </div>
            </div>
            
            <div class="flex flex-col h-1/3">
                <H2 class="mb-5 mt-12">Uitgelichte discussies van de voorbeeldhub</H2>
                <div class="flex justify-between h-full gap-4">
                    <ArticleBlock>
                        <template #image></template>
                        <template #header>ChatGPT en het onderwijs</template>
                        <template #category>Discussie</template>
                        <template #content>Discussie over iets lorem bla bla bla bla bla bla bla bla omschrijving.</template>
                    </ArticleBlock>
                    <ArticleBlock>
                        <template #image></template>
                        <template #header>Voorbeeld titel van een room</template>
                        <template #category>Discussie</template>
                        <template #content>Discussie over iets lorem bla bla bla bla bla bla bla bla omschrijving.</template>
                    </ArticleBlock>
                </div>
            </div>
        </div>
    </div>
</div>
</template>

<!-- <Button class="w-3/6 m-auto" @click="login()">{{ $t("login.login") }}</Button> -->

<script setup lang="ts">
/**
 *
 * This HUB page will be shown if a user is not yet registered or authenticated in PubHubs Central
 *
 */

import { inject } from "vue";
const pubhubs: any = inject("pubhubs");

function login() {
    pubhubs.centralLogin();
}
</script>
