<template>
    <div class="flex h-screen">

            <div class="flex flex-col w-full p-4">
                <div class="flex flex-col w-full">
                    <H3>Laatste nieuws</H3>
                    <div class="flex justify-between gap-8">
                        <ArticleBlock>
                            <template #image>
                                
                            </template>
                            <template #header>Relevante video titel</template>
                            <template #category>Kijk</template>
                            <template #content>Video | 20-12-2022</template>
                        </ArticleBlock>
                        <ArticleBlock>
                            <template #image>
                                <div class="
                                    bg-cover 
                                    bg-[center_top_18rem] 
                                    rounded-t-md 
                                    grow 
                                    bg-[url('https://images.unsplash.com/photo-1581088244515-64dc2471f75f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHwyfHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=500&q=60')]">
                                </div>
                            </template>
                            <template #header>Artikel over iets leuks</template>
                            <template #category>Lees</template>
                            <template #content>Artikel - 28 November</template>
                        </ArticleBlock>
                        <ArticleBlock>
                            <template #image>
                                <div class="
                                    bg-cover 
                                    bg-[center_top_11rem] 
                                    rounded-t-md 
                                    grow 
                                    bg-[url('https://images.unsplash.com/photo-1681616679951-31dd84d5b6f0?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHwzOXx8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=60')]">
                                </div>

                            </template>
                            <template #header>Voorbeeld hub meetup 2022</template>
                            <template #category>Evenement</template>
                            <template #content>9 december, Goffertpark Nijmegen</template>
                        </ArticleBlock>
                    </div>
                    <div class="flex justify-end mt-4">
                        <button class="bg-gray-dark rounded-md px-3 tracking-wide">Meer nieuws →</button>
                    </div>
                </div>


                <SearchInput class="my-8"></SearchInput>


                <H3>Populaire rooms & discussies</H3>
                <div class="flex flex-col w-full gap-y-6">
                    <div class="flex justify-between gap-x-8">
                        <ArticleBlock>
                            <template #image>
                                <div class="
                                    bg-cover  
                                    rounded-t-md 
                                    grow 
                                    bg-[url('https://s3-alpha-sig.figma.com/img/4850/026a/fa713bf9ae412e6fd0dda1f115772ace?Expires=1682899200&Signature=lxeJJnITXDG1fzk3Gi8ZoagcE-Iacx9wQ~1KEVlwNRL8Nr28-ziDxuOW61WkDJB8hAJWUELrl~clfZYPTGDS98nz-Qk0u-mY0-rfkg6xhxfBd5DImkcIVKkOsR8KHFcHl5XVbGh5iz-70jKCXLq9EsyaT4wMz7iy5umWk4eTnltCzDvZ5bnLk7Y5zTVhF001lAdVKUMNcmArQw2jNwuDLHPIddw9~LgPEPlVI-sOHKHr-y1MdipUuE5vP~NNPuPcjBllBwNz2c~2eQPgoxhswxyaCe5r4BR7vraadwsR6XQhI6XfCDAEecHNBGflS5I7oEB8Dr7C45poFQ-HRgeFLQ__&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4')]">
                                </div>
                            </template>
                            <template #header>Smartphones en jonge kinderen</template>
                            <template #category>Discussie</template>
                            <template #content>20-12-2022</template>
                        </ArticleBlock>
                        <ArticleBlock>
                            <template #image></template>
                            <template #header>Voorbeeld discussie</template>
                            <template #category>Discussie</template>
                            <template #content>20-12-2022</template>
                        </ArticleBlock>
                        <ArticleBlock>
                            <template #image>
                                <div class="
                                    bg-cover 
                                    bg-[center_12rem]
                                    rounded-t-md 
                                    grow 
                                    bg-[url('https://images.unsplash.com/photo-1581088244515-64dc2471f75f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHwyfHx8ZW58MHx8fHw%3D&auto=format&fit=crop&w=500&q=60')]">
                                </div>
                            </template>
                            <template #header>Voorbeeld room</template>
                            <template #category>Room</template>
                            <template #content>20-12-2022</template>
                        </ArticleBlock>
                    </div>
                    <div class="flex justify-between gap-8">
                        <ArticleBlock>
                            <template #image>
                                <div class="
                                    bg-cover  
                                    bg-center
                                    rounded-t-md 
                                    grow 
                                    bg-[url('https://s3-alpha-sig.figma.com/img/4850/026a/fa713bf9ae412e6fd0dda1f115772ace?Expires=1682899200&Signature=lxeJJnITXDG1fzk3Gi8ZoagcE-Iacx9wQ~1KEVlwNRL8Nr28-ziDxuOW61WkDJB8hAJWUELrl~clfZYPTGDS98nz-Qk0u-mY0-rfkg6xhxfBd5DImkcIVKkOsR8KHFcHl5XVbGh5iz-70jKCXLq9EsyaT4wMz7iy5umWk4eTnltCzDvZ5bnLk7Y5zTVhF001lAdVKUMNcmArQw2jNwuDLHPIddw9~LgPEPlVI-sOHKHr-y1MdipUuE5vP~NNPuPcjBllBwNz2c~2eQPgoxhswxyaCe5r4BR7vraadwsR6XQhI6XfCDAEecHNBGflS5I7oEB8Dr7C45poFQ-HRgeFLQ__&Key-Pair-Id=APKAQ4GOSFWCVNEHN3O4')]">
                                </div>
                            </template>
                            <template #header>Smartphones en jonge kinderen</template>
                            <template #category>Discussie</template>
                            <template #content>20-12-2022</template>
                        </ArticleBlock>
                        <ArticleBlock>
                            <template #image>
                                <div class="
                                    bg-cover  
                                    bg-[center_13rem]
                                    rounded-t-md 
                                    grow 
                                    bg-[url('https://images.unsplash.com/photo-1680900009683-a822934b058f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHx0b3BpYy1mZWVkfDh8SnBnNktpZGwtSGt8fGVufDB8fHx8&auto=format&fit=crop&w=500&q=60')]">
                                </div>
                            </template>
                            <template #header>Voorbeeld discussie</template>
                            <template #category>Discussie</template>
                            <template #content>20-12-2022</template>
                        </ArticleBlock>
                        <ArticleBlock>
                            <template #image></template>
                            <template #header>Voorbeeld room</template>
                            <template #category>Room</template>
                            <template #content>20-12-2022</template>
                        </ArticleBlock>
                    </div>

                </div>
                <div class="flex justify-end mt-4">
                    <button class="bg-gray-dark rounded-md px-3 tracking-wide">Meer suggesties →</button>
                </div>
                

            </div>    
        </div>
</template>

<script setup lang="ts">
/**
 *
 * This HOME page will be shown if a user is authenticated in PubHubs Central.
 *
 */
</script>
