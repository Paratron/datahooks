# React Data Hooks
This library provides an easy way to let your react apps' components tap into a data pool of
any kind. Connect your components to anything! 

## Creating a hook
Lets say for example, we want to create a data hook to fetch and display an article.

We use the `createHook()` function and pass the data type as a string. In our case
this would be `article` or `story` - just an identifier for the type of data the hook
is handling.

```jsx
// File: myHooks.js
import {createHook} from 'datahooks';

export const useArticle = createHook('article');
```

Now we can use the created hook function inside our components.

```jsx
import {useArticle} from './myHooks';

const ArticlePage = (articleId) => {
	const [article, status] = useArticle(articleId);
	
	if(status.loading){
		return 'Loading article...';
	}
	
	if(status.error){
	    return `Article retrieval failed. Reason: ${status.error}`;
	}
	
	return (
		<div>
		    <h1>{article.headline}</h1>
		    <p>
                {article.content}		        
		    </p>
		</div>
	)
};
``` 

However, the hook does not yet return any data. We need to connect it.

## Connecting the hook to data

The datahooks library offers you to connect responders to the different data
operations your hooks may perform. This operations are `fetch`, `update` and 
`remove`.

When our article hook we created above is being called the first time, the library
will issue a `fetch` request. We need to define a responder function that can answer
that request.

```javascript
import {registerFetchResponder} from 'datahooks';

registerFetchResponder((type, id) => {// Since fetch returns a promise, we may return its result directly.
	return fetch(`/${type}/${id}`);
});
```

This is a _really_ simple responder function that will perform a `fetch` for any data
type. In our case, if we are trying to fetch an article, the called URL will be `/article/[ID]`.

The fetch operation is asynchronous, so we return the promise from the responder. The
library knows how to handle that async operation.
