The _foundation_ layer contains components that all other layers may depend on, that is, this layer acts as a foundation for all other layers.
Components can include things like user preferences or the app's configuration, that we want to be loaded first.
This prevents, for example, flickering from light to dark mode when loading the app or text jumping from one language to another.
Since this layer blocks loading the rest of the application, it should be kept as small as possible.

Note that we do not use pinia stores for this layer. This is because we want the Logger not to be a pinia store (see _Logger_ for more info).
But we want the _Logger_ to depend on the _Config_ and have other pinia stores use the _Logger_.
Since pinia is loaded all at once, we would get a circular dependency if _Config_ was a pinia store: _Logger_ -> Pinia -> _Logger_.
We could still make the _Logger_ a pinia store, but do note that that locks the whole _foundation_ layer into using pinia stores.
