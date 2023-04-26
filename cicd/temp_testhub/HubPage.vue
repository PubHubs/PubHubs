<template>
    <div class="flex flex-row py-11 bg-cover bg-center bg-[url('https://s3-alpha-sig.figma.com/img/5226/6395/88606c64516c0c2db93f6dad946c9c1e?Expires=1682294400&Signature=aybK-1Hkn5Iq3~RIHQrVx4WIhnFg6S4lTkEWlcmm5KFK4mu6jeGzsKluL9CDSXdaQVnlQghC-ksgTDQjkf5xrD2aQpmGwV08irkDN0WYVF2eNPmM~1QM4rj5oSiK2iRg0yls63VKIf0y78sRRfX3C4y3ggyd4aQUOKAqxtyoY6LaM6AFlUdWZoQRtF1NKp66BY6ahFhBJgaY6-I8UX~xekUp0v4RlmlzwwWhSiTzZuEytIUrZE-ffQi8t5Vc3yaITnvI1DkS9HGh2atRmOfVFP276JT4gozXQo4NS93dOucQcOa8tzZ8uwZ7qmWTmrItHTGSGq1CwW00g0IZDK0yzQ__&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4')]">
        <H1 class="ml-8"><template></template>VPRO hubpage</H1>
    </div>

    <div class="flex">
        <div class="flex justify-center flex-col p-12 w-1/3">
            <H2 class="">Over de VPRO Hub</H2>
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
            <Button @click="login()">Doe mee met voorbeeld hub!</Button>
        </div>

        <div class="flex flex-col w-2/3 p-4 justify-center">
            <div class="flex flex-col">
                <H2 class="ml-8 mb-5 mt-12">Uitgelichte rooms van de VPRO Hub</H2>
                <div class="flex justify-around">
                    <ArticleBlock>
                        <template #image>
                            
                        </template>
                        <template #header>Tech nieuws</template>
                        <template #category>Room</template>
                        <template #content>Gesprekken over het laatste tech gerelateerde nieuws.</template>
                    </ArticleBlock>
                    <ArticleBlock>
                        <template #image>                            
                            <div
                                class="
                                bg-cover 
                                bg-[center_top_18rem] 
                                rounded-t-md 
                                grow 
                                bg-[url('https://s3-alpha-sig.figma.com/img/742a/6283/f82f903e9f96dd7fd5ce3b4337ddc1a0?Expires=1682294400&Signature=O4L0U4iXgQrcyprsi1sC5xQeilCYXasgVUBT6JoTB34jTU3vynXjuf4XAqNNulYVRut0Fm7c4mtv-YUAXDSVPM9aNPEAr3WSL1jARbKvmdYm1Sx9aADfXs~vEAgS~15xYPJhUvtLtPolUUwvJwMkCl7vSoGmnyrZDSFHIb21d~7jNvjARckIsFN9JAss3FKtE0IyEOuCAcshcAig0PLFD9uCoDpznA5TPD2qJ5mQgKfPn-pUHcETuQIvGbWf40E1SxeI7-GOifFLTPWV3NAkF626OEiHu7h1Dl-8J6jH9gzc8xaTtcI7nEBejd5AF4Krf5bdrVd1al~cATtcQ0V3fQ__&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4')]"
                            ></div>
                        </template>
                        <template #header>Smartphones en jonge kinderen</template>
                        <template #category>Room</template>
                        <template #content>Gesprekken over hoe om te gaan met smartphones en jonge kinderen.</template>
                    </ArticleBlock>
                </div>
            </div>
            
            <div class="flex flex-col">
                <H2 class="ml-8 mb-5 mt-12">Uitgelichte discussies van de voorbeeldhub</H2>
                <div class="flex justify-around">
                    <ArticleBlock>
                        <template #image>
                            <div class="
                                    bg-cover  
                                    rounded-t-md 
                                    grow 
                                    bg-[url('https://s3-alpha-sig.figma.com/img/4850/026a/fa713bf9ae412e6fd0dda1f115772ace?Expires=1682899200&Signature=lxeJJnITXDG1fzk3Gi8ZoagcE-Iacx9wQ~1KEVlwNRL8Nr28-ziDxuOW61WkDJB8hAJWUELrl~clfZYPTGDS98nz-Qk0u-mY0-rfkg6xhxfBd5DImkcIVKkOsR8KHFcHl5XVbGh5iz-70jKCXLq9EsyaT4wMz7iy5umWk4eTnltCzDvZ5bnLk7Y5zTVhF001lAdVKUMNcmArQw2jNwuDLHPIddw9~LgPEPlVI-sOHKHr-y1MdipUuE5vP~NNPuPcjBllBwNz2c~2eQPgoxhswxyaCe5r4BR7vraadwsR6XQhI6XfCDAEecHNBGflS5I7oEB8Dr7C45poFQ-HRgeFLQ__&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4')]">
                                </div>
                        </template>
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
