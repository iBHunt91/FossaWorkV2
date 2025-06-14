# React Documentation Reference

This documentation was fetched from Context7 for the React library (`/reactjs/react.dev`).

## Table of Contents

1. [Hook Usage and Best Practices](#hook-usage-and-best-practices)
2. [State Management](#state-management)
3. [Effects and Lifecycle](#effects-and-lifecycle)
4. [Component Patterns](#component-patterns)
5. [Custom Hooks](#custom-hooks)
6. [Performance Optimization](#performance-optimization)

---

## Hook Usage and Best Practices

### Correct Hook Usage in React Function Components

```javascript
function Counter() {
  // ✅ Good: top-level in a function component
  const [count, setCount] = useState(0);
  // ...
}

function useWindowWidth() {
  // ✅ Good: top-level in a custom Hook
  const [width, setWidth] = useState(window.innerWidth);
  // ...
}
```

### Rules of Hooks

1. **Only Call Hooks at the Top Level**: Don't call Hooks inside loops, conditions, or nested functions
2. **Only Call Hooks from React Functions**: Either from React function components or from custom Hooks

### Avoid Conditional Hook Calls

```javascript
// ❌ Bad - Hook called conditionally
function FeedbackForm() {
  const [isSent, setIsSent] = useState(false);
  if (isSent) {
    return <h1>Thank you!</h1>;
  }
  // This would cause an error:
  // const [message, setMessage] = useState('');
}

// ✅ Good - All hooks called unconditionally
function FeedbackForm() {
  const [isSent, setIsSent] = useState(false);
  const [message, setMessage] = useState('');

  if (isSent) {
    return <h1>Thank you!</h1>;
  }
  // ... rest of form
}
```

---

## State Management

### Basic useState Pattern

```javascript
const [index, setIndex] = useState(0);
```

- On first render: Returns initial value (0)
- On subsequent renders: Returns current state value
- Calling `setIndex` triggers a re-render with new value

### Managing Complex State

```javascript
import { useState } from 'react';
import { sculptureList } from './data.js';

export default function Gallery() {
  const [index, setIndex] = useState(0);
  const [showMore, setShowMore] = useState(false);

  function handleNextClick() {
    setIndex(index + 1);
  }

  function handleMoreClick() {
    setShowMore(!showMore);
  }

  let sculpture = sculptureList[index];
  return (
    <section>
      <button onClick={handleNextClick}>Next</button>
      <h2>
        <i>{sculpture.name}</i> by {sculpture.artist}
      </h2>
      <h3>({index + 1} of {sculptureList.length})</h3>
      <button onClick={handleMoreClick}>
        {showMore ? 'Hide' : 'Show'} details
      </button>
      {showMore && <p>{sculpture.description}</p>}
      <img src={sculpture.url} alt={sculpture.alt} />
    </section>
  );
}
```

### useReducer for Complex State Logic

```javascript
import { useReducer } from 'react';

function tasksReducer(tasks, action) {
  switch (action.type) {
    case 'added':
      return [...tasks, {
        id: action.id,
        text: action.text,
        done: false
      }];
    case 'changed':
      return tasks.map(t =>
        t.id === action.task.id ? action.task : t
      );
    case 'deleted':
      return tasks.filter(t => t.id !== action.id);
    default:
      throw Error('Unknown action: ' + action.type);
  }
}

export default function TaskApp() {
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks);

  function handleAddTask(text) {
    dispatch({ type: 'added', id: nextId++, text: text });
  }
  // ... rest of component
}
```

---

## Effects and Lifecycle

### Basic useEffect Pattern

```javascript
function ChatRoom({ roomId }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => {
      connection.disconnect();
    };
  }, [roomId]);
  // ...
}
```

### Effect Dependencies

```javascript
// Non-reactive values (defined outside component)
const serverUrl = 'https://localhost:1234';
const roomId = 'general';

function ChatRoom() {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => connection.disconnect();
  }, []); // ✅ Empty deps - values are non-reactive
}

// Reactive values (props and state)
function ChatRoom({ roomId }) {
  const [serverUrl, setServerUrl] = useState('https://localhost:1234');

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, serverUrl]); // ✅ Include all reactive values
}
```

### Conditional Effects

```javascript
function App() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [canMove, setCanMove] = useState(true);

  useEffect(() => {
    function handleMove(e) {
      if (canMove) {
        setPosition({ x: e.clientX, y: e.clientY });
      }
    }

    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, [canMove]);
  // ...
}
```

### Data Fetching Pattern

```javascript
function Page() {
  const [planetList, setPlanetList] = useState([]);
  const [planetId, setPlanetId] = useState('');

  useEffect(() => {
    let ignore = false;
    
    fetchData('/planets').then(result => {
      if (!ignore) {
        setPlanetList(result);
        setPlanetId(result[0].id);
      }
    });
    
    return () => {
      ignore = true;  // Prevent state updates after unmount
    };
  }, []);
  // ...
}
```

---

## Component Patterns

### Component Composition

```javascript
function BlogPost() {
  return <Layout><Article /></Layout>; // ✅ Good: Components in JSX
}

// ❌ Bad: Never call components as functions
function BlogPost() {
  return <Layout>{Article()}</Layout>;
}
```

### Props and Children

```javascript
function App() {
  const time = useTime();
  const [color, setColor] = useState('lightcoral');
  
  return (
    <div>
      <p>
        Pick a color:{' '}
        <select value={color} onChange={e => setColor(e.target.value)}>
          <option value="lightcoral">lightcoral</option>
          <option value="midnightblue">midnightblue</option>
        </select>
      </p>
      <Clock color={color} time={time.toLocaleTimeString()} />
    </div>
  );
}
```

### Preserving and Resetting State

```javascript
export default function Scoreboard() {
  const [isPlayerA, setIsPlayerA] = useState(true);
  
  return (
    <div>
      {isPlayerA && <Counter person="Taylor" />}
      {!isPlayerA && <Counter person="Sarah" />}
      <button onClick={() => setIsPlayerA(!isPlayerA)}>
        Next player!
      </button>
    </div>
  );
}
```

Different positions in the tree = different component instances = separate state

---

## Custom Hooks

### Basic Custom Hook

```javascript
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return isOnline;
}
```

### Custom Hook with Parameters

```javascript
function useChatRoom({ serverUrl, roomId }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.connect();
    
    return () => connection.disconnect();
  }, [roomId, serverUrl]);
}

// Usage
function ChatRoom({ roomId }) {
  const [serverUrl, setServerUrl] = useState('https://localhost:1234');
  
  useChatRoom({ roomId, serverUrl });
  // ...
}
```

### Custom Hook Returning Functions

```javascript
function useRouter() {
  const { dispatch } = useContext(RouterStateContext);

  const navigate = useCallback((url) => {
    dispatch({ type: 'navigate', url });
  }, [dispatch]);

  const goBack = useCallback(() => {
    dispatch({ type: 'back' });
  }, [dispatch]);

  return { navigate, goBack };
}
```

### Sharing Logic, Not State

```javascript
// Each component gets its own state
function StatusBar() {
  const isOnline = useOnlineStatus(); // Independent state
  return <h1>{isOnline ? '✅ Online' : '❌ Disconnected'}</h1>;
}

function SaveButton() {
  const isOnline = useOnlineStatus(); // Independent state
  return (
    <button disabled={!isOnline}>
      {isOnline ? 'Save progress' : 'Reconnecting...'}
    </button>
  );
}
```

---

## Performance Optimization

### useMemo for Expensive Calculations

```javascript
function TodoList({ todos, tab, theme }) {
  const visibleTodos = useMemo(
    () => filterTodos(todos, tab),
    [todos, tab]  // Only re-calculate when these change
  );
  // ...
}
```

### useCallback for Stable Function References

```javascript
function ProductPage({ productId, referrer, theme }) {
  const handleSubmit = useCallback((orderDetails) => {
    post('/product/' + productId + '/buy', {
      referrer,
      orderDetails,
    });
  }, [productId, referrer]);
  
  return (
    <div className={theme}>
      <ShippingForm onSubmit={handleSubmit} />
    </div>
  );
}
```

### React.memo for Component Memoization

```javascript
const ShippingForm = React.memo(function ShippingForm({ onSubmit }) {
  // ... component implementation
});
```

---

## Best Practices Summary

1. **Keep Components Pure**: No side effects during render
2. **Use Effects for Synchronization**: Connect to external systems
3. **Declare All Dependencies**: Include all reactive values in dependency arrays
4. **Custom Hooks for Reusable Logic**: Extract common patterns
5. **Optimize Responsibly**: Use memoization when performance issues are measured
6. **Follow Hook Rules**: Top-level only, React functions only

---

## Additional Resources

- Trust Score: 9/10
- Code Snippets Available: 2791
- Source: React Official Documentation (reactjs/react.dev)