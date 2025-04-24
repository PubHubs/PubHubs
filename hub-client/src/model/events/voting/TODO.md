The VotingWidget code & components are based on work of a student group.
Although they did nice work, there was a lot of refacturing needed after half a year of PubHubs updates.

What is refactured:

- Original it was build as plugin. Now it is an integral part of the code.
- API calls now are part of the normal Room/Timeline code.
- A lot of components where simplified.
- A lot of the code was moved from components to the model.

The widget and the tests works fine. But for pragmatical reasons the refacturing is not complete. The code could be better split and better typed.

Next steps could be:

- Better use of TypeScript types and simplify them where could.
- Move more code out of the components to the model. Notably VotingWidget.vue has still a lot of code that could be part of the model (classes/types). This involves also refacturing the tests.
- Only send a VotingWidgetEdit event when a voting widget is actually edited.
