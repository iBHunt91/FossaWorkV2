# SQLAlchemy Documentation Reference

This documentation was fetched from Context7 for the SQLAlchemy library (`/sqlalchemy/sqlalchemy`).

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [ORM Models](#orm-models)
3. [Sessions and Transactions](#sessions-and-transactions)
4. [Querying](#querying)
5. [Relationships](#relationships)
6. [Bulk Operations](#bulk-operations)
7. [Core vs ORM](#core-vs-orm)
8. [Best Practices](#best-practices)

---

## Basic Setup

### Creating an Engine

```python
from sqlalchemy import create_engine

# Basic engine creation
engine = create_engine("postgresql+psycopg2://scott:tiger@localhost/mydatabase")

# SQLite in-memory database
engine = create_engine("sqlite://", echo=True)

# MySQL connection
engine = create_engine("mysql+mysqldb://scott:tiger@localhost/test")
```

### Installing SQLAlchemy

```bash
pip install sqlalchemy
```

---

## ORM Models

### Defining a Declarative Base

```python
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass
```

### Basic Model Definition with Type Annotations

```python
from typing import List, Optional
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

class User(Base):
    __tablename__ = "user_account"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30))
    fullname: Mapped[Optional[str]]
    
    addresses: Mapped[List["Address"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"User(id={self.id!r}, name={self.name!r}, fullname={self.fullname!r})"

class Address(Base):
    __tablename__ = "address"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email_address: Mapped[str]
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"))
    
    user: Mapped["User"] = relationship(back_populates="addresses")

    def __repr__(self) -> str:
        return f"Address(id={self.id!r}, email_address={self.email_address!r})"
```

### Creating Tables

```python
# Create all tables defined by the models
Base.metadata.create_all(engine)
```

---

## Sessions and Transactions

### Using Session with Context Manager

```python
from sqlalchemy.orm import Session

# Basic session usage
with Session(engine) as session:
    session.add(some_object)
    session.add(some_other_object)
    session.commit()
```

### Using sessionmaker Factory

```python
from sqlalchemy.orm import sessionmaker

# Create a sessionmaker factory
Session = sessionmaker(engine)

# Use the factory to create sessions
with Session() as session:
    session.add(some_object)
    session.commit()
```

### Begin Once Pattern

```python
# Transaction automatically committed at end of block
with engine.begin() as conn:
    result = conn.execute(stmt)
```

### Nested Transactions (Savepoints)

```python
# Handle potential conflicts with savepoints
try:
    with session.begin_nested():
        session.add(Product(id=1))
except exc.IntegrityError:
    print("row already exists")
```

---

## Querying

### Basic Select Queries

```python
from sqlalchemy import select

# Simple select
stmt = select(User).where(User.name == "spongebob")
result = session.execute(stmt)
for user_obj in result.scalars():
    print(f"{user_obj.name} {user_obj.fullname}")

# Get first result
user = session.scalars(
    select(User).where(User.name == "some name")
).first()
```

### Joins

```python
# Join using relationship
stmt = select(User).join(User.addresses)

# Join with filter
stmt = select(User).join(User.addresses).filter(Address.email == "some@email.case")

# Iterate results
for user in session.execute(stmt).scalars():
    print(user.name)
```

### Eager Loading

```python
from sqlalchemy.orm import joinedload

# Eager load related objects
users = session.scalars(
    select(User).options(joinedload(User.addresses))
).unique().all()
```

### Complex Queries with Method Chaining

```python
stmt = (
    select(user.c.name)
    .where(user.c.id > 5)
    .where(user.c.name.like("e%"))
    .order_by(user.c.name)
)
```

---

## Relationships

### One-to-Many / Many-to-One Bidirectional

```python
class Parent(Base):
    __tablename__ = "parent_table"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    children: Mapped[List["Child"]] = relationship(back_populates="parent")

class Child(Base):
    __tablename__ = "child_table"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    parent_id: Mapped[int] = mapped_column(ForeignKey("parent_table.id"))
    parent: Mapped["Parent"] = relationship(back_populates="children")
```

### Many-to-Many with Association Table

```python
from sqlalchemy import Table, Column

order_items_table = Table(
    "order_items",
    Base.metadata,
    Column("order_id", ForeignKey("user_order.id"), primary_key=True),
    Column("item_id", ForeignKey("item.id"), primary_key=True),
)

class Order(Base):
    __tablename__ = "user_order"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("user_account.id"))
    items: Mapped[List["Item"]] = relationship(secondary=order_items_table)

class Item(Base):
    __tablename__ = "item"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    description: Mapped[str]
```

### Cascade Options

```python
class User(Base):
    # Cascade deletes to related addresses
    addresses = relationship("Address", cascade="all, delete")
```

---

## Bulk Operations

### Bulk Insert with RETURNING

```python
from sqlalchemy import insert

users = session.scalars(
    insert(User).returning(User),
    [
        {"name": "spongebob", "fullname": "Spongebob Squarepants"},
        {"name": "sandy", "fullname": "Sandy Cheeks"},
        {"name": "patrick", "fullname": "Patrick Star"},
    ],
)
print(users.all())
```

### Bulk Insert with Fixed Values

```python
from sqlalchemy import func

log_records = session.scalars(
    insert(LogRecord).values(code="SQLA", timestamp=func.now()).returning(LogRecord),
    [
        {"message": "log message #1"},
        {"message": "log message #2"},
        {"message": "log message #3"},
    ],
)
```

### Bulk Update

```python
from sqlalchemy import update

session.execute(
    update(User)
    .where(User.name == "foo")
    .values(fullname="Foo Bar")
    .execution_options(synchronize_session="evaluate")
)
```

---

## Core vs ORM

### Core Insert Statement

```python
from sqlalchemy import insert

stmt = insert(user_table).values(name="spongebob", fullname="Spongebob Squarepants")
```

### Execute with Connection

```python
with engine.connect() as conn:
    result = conn.execute(stmt)
    print(result.all())
```

### Using text() for Raw SQL

```python
from sqlalchemy import text

with engine.begin() as connection:
    connection.execute(text("CREATE TABLE foo (id integer)"))
    connection.execute(text("INSERT INTO foo (id) VALUES (1)"))
```

---

## Best Practices

### Foreign Key Constraints

```python
# Single column foreign key
Column("user_id", Integer, ForeignKey("user.user_id"), nullable=False)

# With ON DELETE/UPDATE
Column(
    "id",
    Integer,
    ForeignKey("parent.id", onupdate="CASCADE", ondelete="CASCADE"),
    primary_key=True,
)
```

### Default Values

```python
# Scalar default
Column("somecolumn", Integer, default=12)

# Function default
from sqlalchemy import func
create_date: Mapped[datetime] = mapped_column(insert_default=func.now())
```

### Type Annotations with Annotated

```python
from typing import Annotated
from datetime import datetime

# Define reusable annotated types
intpk = Annotated[int, mapped_column(primary_key=True)]
timestamp = Annotated[datetime, mapped_column(insert_default=func.now())]

class SomeClass(Base):
    __tablename__ = "some_table"
    
    id: Mapped[intpk]
    created_at: Mapped[timestamp]
```

### Session State Management

```python
# Proper transaction handling pattern
def method_a(session):
    method_b(session)

def method_b(session):
    session.add(SomeObject("bat", "lala"))

# Create session and handle transaction at outermost scope
with Session() as session:
    with session.begin():
        method_a(session)
```

---

## Additional Resources

- Trust Score: 10/10 (Not provided, but SQLAlchemy is a core Python library)
- Code Snippets Available: 2476
- Source: SQLAlchemy Official Documentation (sqlalchemy/sqlalchemy)