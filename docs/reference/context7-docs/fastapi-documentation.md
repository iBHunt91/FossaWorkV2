# FastAPI Documentation Reference

This documentation was fetched from Context7 for the FastAPI library (`/tiangolo/fastapi`).

## Table of Contents

1. [Basic Application Setup](#basic-application-setup)
2. [Route Operations](#route-operations)
3. [Pydantic Models](#pydantic-models)
4. [Dependency Injection](#dependency-injection)
5. [Database Integration](#database-integration)
6. [Authentication & Security](#authentication--security)
7. [WebSockets](#websockets)
8. [Settings & Configuration](#settings--configuration)
9. [Testing](#testing)

---

## Basic Application Setup

### Simple FastAPI App

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}
```

### Async Application

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
async def read_root():
    return {"Hello": "World"}

@app.get("/items/{item_id}")
async def read_item(item_id: int, q: Union[str, None] = None):
    return {"item_id": item_id, "q": q}
```

### Running the Application

```bash
# Install FastAPI
pip install fastapi

# Run with development server
fastapi dev main.py
```

---

## Route Operations

### Request Methods

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    price: float
    is_offer: Union[bool, None] = None

@app.get("/items/{item_id}")
def read_item(item_id: int):
    return {"item_id": item_id}

@app.post("/items/")
def create_item(item: Item):
    return item

@app.put("/items/{item_id}")
def update_item(item_id: int, item: Item):
    return {"item_name": item.name, "item_id": item_id}
```

### Path Parameters and Query Parameters

```python
@app.get("/items/{item_id}")
async def read_item(
    item_id: int,  # Path parameter
    q: Union[str, None] = None,  # Query parameter
    skip: int = 0,  # Query parameter with default
    limit: int = 10  # Query parameter with default
):
    return {"item_id": item_id, "q": q, "skip": skip, "limit": limit}
```

---

## Pydantic Models

### Basic Model Definition

```python
from pydantic import BaseModel
from typing import Optional

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None
```

### Model Inheritance for Different Use Cases

```python
class UserBase(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None

class UserIn(UserBase):
    password: str  # For input (includes password)

class UserOut(UserBase):
    pass  # For output (no password)

class UserInDB(UserBase):
    hashed_password: str  # For database storage
```

### Working with Models

```python
# Creating instances
user_in = UserIn(username="john", password="secret", email="john@example.com")

# Converting to dict
user_dict = user_in.dict()

# Creating from dict with unpacking
user_db = UserInDB(**user_dict, hashed_password="hashedsecret")

# Using model_dump() in Pydantic v2
user_dict = user_in.model_dump()
```

### Advanced Model Features

```python
from pydantic import BaseModel, HttpUrl

class Image(BaseModel):
    url: HttpUrl  # Automatic URL validation
    name: str

# Query Parameter Models
class CommonQueryParams(BaseModel):
    q: Optional[str] = None
    skip: int = 0
    limit: int = 100

@app.get("/items/")
async def read_items(commons: CommonQueryParams = Query(...)):
    return {"q": commons.q, "skip": commons.skip, "limit": commons.limit}
```

---

## Dependency Injection

### Basic Dependencies

```python
from fastapi import Depends

async def common_parameters(q: str = None, skip: int = 0, limit: int = 100):
    return {"q": q, "skip": skip, "limit": limit}

@app.get("/items/")
async def read_items(commons: dict = Depends(common_parameters)):
    return commons
```

### Dependency with Yield (for cleanup)

```python
def get_db():
    db = DBSession()
    try:
        yield db
    finally:
        db.close()

@app.get("/items/")
def read_items(db: Session = Depends(get_db)):
    return db.query(Item).all()
```

### Sub-dependencies

```python
async def query_extractor(q: str):
    return q

async def query_or_cookie_extractor(
    q: str = Depends(query_extractor),
    last_query: str = Cookie(None)
):
    if not q:
        return last_query
    return q
```

---

## Database Integration

### SQLModel Setup

```python
from sqlmodel import Field, Session, SQLModel, create_engine, select
from typing import Optional

# Database models
class HeroBase(SQLModel):
    name: str
    age: Optional[int] = None

class Hero(HeroBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    secret_name: str

# Engine setup
engine = create_engine("sqlite:///database.db")
SQLModel.metadata.create_all(engine)

# Session dependency
def get_session():
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]
```

### Database Operations

```python
@app.post("/heroes/", response_model=Hero)
def create_hero(hero: Hero, session: SessionDep):
    session.add(hero)
    session.commit()
    session.refresh(hero)
    return hero

@app.get("/heroes/", response_model=List[Hero])
def read_heroes(session: SessionDep):
    heroes = session.exec(select(Hero)).all()
    return heroes
```

---

## Authentication & Security

### OAuth2 with Password Bearer

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class User(BaseModel):
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None

class UserInDB(User):
    hashed_password: str

def fake_decode_token(token: str):
    # Mock token decoding
    user = get_user(token)
    return user

async def get_current_user(token: str = Depends(oauth2_scheme)):
    user = fake_decode_token(token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

@app.get("/users/me/")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
```

### JWT Token Implementation

```python
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key"  # Change in production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    access_token = create_access_token(
        data={"sub": user.username}, 
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}
```

---

## WebSockets

### Basic WebSocket Endpoint

```python
from fastapi import FastAPI, WebSocket
from fastapi.websockets import WebSocketDisconnect

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Message text was: {data}")
    except WebSocketDisconnect:
        print("Client disconnected")
```

### WebSocket with Dependencies

```python
from fastapi import Cookie, Depends, WebSocket, WebSocketException

async def get_cookie_or_token(
    websocket: WebSocket,
    cookie: Optional[str] = Cookie(None),
    token: Optional[str] = Header(None),
):
    if cookie is None and token is None:
        raise WebSocketException(code=1008, reason="Not authenticated")
    return cookie or token

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    client_id: int,
    q: Optional[str] = Query(None),
    cookie_or_token: str = Depends(get_cookie_or_token),
):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(
                f"Client {client_id} says: {data}"
            )
    except WebSocketException as e:
        await websocket.close(code=e.code, reason=e.reason)
```

### WebSocket HTML Client Example

```python
html = """
<!DOCTYPE html>
<html>
<head>
    <title>WebSocket Chat</title>
</head>
<body>
    <h1>WebSocket Chat</h1>
    <form action="" onsubmit="sendMessage(event)">
        <input type="text" id="messageText" autocomplete="off"/>
        <button>Send</button>
    </form>
    <ul id='messages'></ul>
    <script>
        var ws = new WebSocket("ws://localhost:8000/ws");
        ws.onmessage = function(event) {
            var messages = document.getElementById('messages')
            var message = document.createElement('li')
            var content = document.createTextNode(event.data)
            message.appendChild(content)
            messages.appendChild(message)
        };
        function sendMessage(event) {
            var input = document.getElementById("messageText")
            ws.send(input.value)
            input.value = ''
            event.preventDefault()
        }
    </script>
</body>
</html>
"""

@app.get("/")
async def get():
    return HTMLResponse(html)
```

---

## Settings & Configuration

### Pydantic Settings

```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    app_name: str = "Awesome API"
    admin_email: str
    items_per_user: int = 50

    class Config:
        env_file = ".env"

@lru_cache
def get_settings():
    return Settings()

@app.get("/info")
async def info(settings: Annotated[Settings, Depends(get_settings)]):
    return {
        "app_name": settings.app_name,
        "admin_email": settings.admin_email,
        "items_per_user": settings.items_per_user,
    }
```

---

## Testing

### Testing WebSockets

```python
from fastapi.testclient import TestClient

def test_websocket_connection():
    client = TestClient(app)
    with client.websocket_connect("/ws") as websocket:
        websocket.send_text("Hello")
        data = websocket.receive_text()
        assert data == "Message text was: Hello"
```

---

## Best Practices

1. **Use Type Hints**: FastAPI leverages Python type hints for validation and documentation
2. **Pydantic Models**: Define clear input/output models for data validation
3. **Dependency Injection**: Use dependencies for reusable logic (auth, DB sessions)
4. **Async When Possible**: Use `async def` for I/O-bound operations
5. **Security**: Never store plain passwords, use proper hashing
6. **Settings Management**: Use Pydantic Settings with `.env` files
7. **Error Handling**: Use appropriate HTTP status codes and exception handlers

---

## Additional Resources

- Trust Score: 9.9/10
- Code Snippets Available: 1253
- Version Available: 0.115.12
- Source: FastAPI Official Documentation (tiangolo/fastapi)