# Pydantic Documentation Reference

This documentation was fetched from Context7 for the Pydantic library (`/pydantic/pydantic`).

## Table of Contents

1. [Basic Usage](#basic-usage)
2. [Models and Fields](#models-and-fields)
3. [Validation](#validation)
4. [Type Annotations](#type-annotations)
5. [Serialization](#serialization)
6. [Custom Validators](#custom-validators)
7. [Configuration](#configuration)
8. [Advanced Features](#advanced-features)

---

## Basic Usage

### Installation

```bash
pip install pydantic
# or
uv add pydantic
# or
conda install pydantic -c conda-forge
```

### Basic Model Definition

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class User(BaseModel):
    id: int
    name: str = 'John Doe'
    signup_ts: Optional[datetime] = None
    friends: list[int] = []

external_data = {'id': '123', 'signup_ts': '2017-06-01 12:22', 'friends': [1, '2', b'3']}
user = User(**external_data)
print(user)
#> User id=123 name='John Doe' signup_ts=datetime.datetime(2017, 6, 1, 12, 22) friends=[1, 2, 3]
print(user.id)
#> 123
```

### Why Pydantic - Type Hints for Validation

```python
from typing import Annotated, Literal
from annotated_types import Gt
from pydantic import BaseModel

class Fruit(BaseModel):
    name: str  # Required string
    color: Literal['red', 'green']  # Enumerated values
    weight: Annotated[float, Gt(0)]  # Float greater than 0
    bazam: dict[str, list[tuple[int, bool, float]]]  # Complex nested structure

print(
    Fruit(
        name='Apple',
        color='red',
        weight=4.2,
        bazam={'foobar': [(1, True, 0.1)]},
    )
)
#> name='Apple' color='red' weight=4.2 bazam={'foobar': [(1, True, 0.1)]}
```

---

## Models and Fields

### Model Configuration

```python
from pydantic import BaseModel, ConfigDict

class User(BaseModel):
    id: int
    name: str = 'Jane Doe'
    
    model_config = ConfigDict(str_max_length=10)
```

### Field Definition with Constraints

```python
from pydantic import BaseModel, Field

class Model(BaseModel):
    name: str = Field(frozen=True)
    age: int = Field(gt=0, le=100)
    
# Using default_factory for dynamic defaults
from uuid import uuid4

class User(BaseModel):
    id: str = Field(default_factory=lambda: uuid4().hex)
```

### Nested Models

```python
from typing import Optional
from pydantic import BaseModel

class Foo(BaseModel):
    count: int
    size: Optional[float] = None

class Bar(BaseModel):
    apple: str = 'x'
    banana: str = 'y'

class Spam(BaseModel):
    foo: Foo
    bars: list[Bar]

m = Spam(foo={'count': 4}, bars=[{'apple': 'x1'}, {'apple': 'x2'}])
print(m)
# foo=Foo(count=4, size=None) bars=[Bar(apple='x1', banana='y'), Bar(apple='x2', banana='y')]
```

### Required vs Optional Fields

```python
from typing import Optional
from pydantic import BaseModel, ValidationError

class Foo(BaseModel):
    f1: str  # required, cannot be None
    f2: Optional[str]  # required, can be None - same as str | None
    f3: Optional[str] = None  # not required, can be None
    f4: str = 'Foobar'  # not required, but cannot be None

try:
    Foo(f1=None, f2=None, f4='b')
except ValidationError as e:
    print(e)
    """
    1 validation error for Foo
    f1
      Input should be a valid string [type=string_type, input_value=None, input_type=NoneType]
    """
```

---

## Validation

### Model Validation Methods

```python
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ValidationError

class User(BaseModel):
    id: int
    name: str = 'John Doe'
    signup_ts: Optional[datetime] = None

# Validate from dictionary
m = User.model_validate({'id': 123, 'name': 'James'})
print(m)
# id=123 name='James' signup_ts=None

# Validate from JSON string
m = User.model_validate_json('{"id": 123, "name": "James"}')
print(m)
# id=123 name='James' signup_ts=None

# Validate from strings (useful for form data)
m = User.model_validate_strings({'id': '123', 'name': 'James'})
print(m)
# id=123 name='James' signup_ts=None
```

### Validation Errors

```python
from pydantic import BaseModel, Field, ValidationError, field_validator

class Model(BaseModel):
    is_required: float
    gt_int: int = Field(gt=42)
    list_of_ints: list[int]
    a_float: float

    @field_validator('a_float', mode='after')
    @classmethod
    def validate_float(cls, value: float) -> float:
        if value > 2.0:
            raise ValueError('Invalid float value')
        return value

data = {
    'list_of_ints': ['1', 2, 'bad'],
    'a_float': 3.0,
    'gt_int': 21,
}

try:
    Model(**data)
except ValidationError as e:
    print(e)
    print(e.errors())  # Get structured error details
```

### Type Coercion

```python
from pydantic import BaseModel

class Model(BaseModel):
    a: int
    b: float
    c: str

print(Model(a=3.000, b='2.72', c=b'binary data').model_dump())
#> {'a': 3, 'b': 2.72, 'c': 'binary data'}
```

---

## Type Annotations

### Using Annotated for Constraints

```python
from typing import Annotated, Optional
from pydantic import BaseModel, Field

class Foo(BaseModel):
    positive: Optional[Annotated[int, Field(gt=0)]]
    # Can error in some cases, not recommended:
    non_negative: Optional[int] = Field(ge=0)
```

### Custom Types with Validation

```python
from typing import Annotated
from pydantic import (
    AfterValidator,
    PlainSerializer,
    TypeAdapter,
    WithJsonSchema,
)

TruncatedFloat = Annotated[
    float,
    AfterValidator(lambda x: round(x, 1)),
    PlainSerializer(lambda x: f'{x:.1e}', return_type=str),
    WithJsonSchema({'type': 'string'}, mode='serialization'),
]

ta = TypeAdapter(TruncatedFloat)

input = 1.02345
assert ta.validate_python(input) == 1.0
assert ta.dump_json(input) == b'"1.0e+00"'
```

### TypeAdapter for Non-Model Types

```python
from pydantic import TypeAdapter

adapter = TypeAdapter(list[int])
assert adapter.validate_python(['1', '2', '3']) == [1, 2, 3]
print(adapter.json_schema())
#> {'items': {'type': 'integer'}, 'type': 'array'}
```

---

## Serialization

### Basic Serialization

```python
from datetime import datetime
from pydantic import BaseModel

class Meeting(BaseModel):
    when: datetime
    where: bytes
    why: str = 'No idea'

m = Meeting(when='2020-01-01T12:00', where='home')
print(m.model_dump(exclude_unset=True))
print(m.model_dump(exclude={'where'}, mode='json'))
print(m.model_dump_json(exclude_defaults=True))
```

### Include/Exclude Fields

```python
from pydantic import BaseModel, SecretStr

class User(BaseModel):
    id: int
    username: str
    password: SecretStr

class Transaction(BaseModel):
    id: str
    user: User
    value: int

t = Transaction(
    id='1234567890',
    user=User(id=42, username='JohnDoe', password='hashedpassword'),
    value=9876543210,
)

# using a set:
print(t.model_dump(exclude={'user', 'value'}))
#> {'id': '1234567890'}

# using a dict:
print(t.model_dump(exclude={'user': {'username', 'password'}, 'value': True}))
#> {'id': '1234567890', 'user': {'id': 42}}
```

### JSON Serialization

```python
from datetime import datetime
from pydantic import BaseModel

class BarModel(BaseModel):
    whatever: int

class FooBarModel(BaseModel):
    foo: datetime
    bar: BarModel

m = FooBarModel(foo=datetime(2032, 6, 1, 12, 13, 14), bar={'whatever': 123})
print(m.model_dump_json())
print(m.model_dump_json(indent=2))
```

---

## Custom Validators

### After Validators

```python
from typing import Annotated
from pydantic import AfterValidator, BaseModel, ValidationError

def is_even(value: int) -> int:
    if value % 2 == 1:
        raise ValueError(f'{value} is not an even number')
    return value

class Model(BaseModel):
    number: Annotated[int, AfterValidator(is_even)]

try:
    Model(number=1)
except ValidationError as err:
    print(err)
```

### Before Validators

```python
from typing import Annotated, Any
from pydantic import BaseModel, BeforeValidator, ValidationError

def ensure_list(value: Any) -> Any:
    if not isinstance(value, list):
        return [value]
    else:
        return value

class Model(BaseModel):
    numbers: Annotated[list[int], BeforeValidator(ensure_list)]

print(Model(numbers=2))
#> numbers=[2]
```

### Field Validators

```python
from pydantic import BaseModel, field_validator

class Model(BaseModel):
    name: str
    
    @field_validator('name')
    @classmethod
    def name_must_contain_space(cls, v):
        if ' ' not in v:
            raise ValueError('must contain a space')
        return v.title()
```

---

## Configuration

### Model Configuration

```python
from pydantic import BaseModel, ConfigDict, ValidationError

class Model(BaseModel):
    model_config = ConfigDict(
        str_max_length=5,
        strict=True,
        validate_assignment=True,
        extra='forbid'
    )
    
    v: str
```

### JSON Parsing with Strict Mode

```python
from datetime import date
from pydantic import BaseModel, ConfigDict, ValidationError

class Event(BaseModel):
    model_config = ConfigDict(strict=True)
    
    when: date
    where: tuple[int, int]

json_data = '{"when": "1987-01-28", "where": [51, -1]}'
print(Event.model_validate_json(json_data))  # Works - JSON mode allows string dates
#> when=datetime.date(1987, 1, 28) where=(51, -1)

try:
    Event.model_validate({'when': '1987-01-28', 'where': [51, -1]})  # Fails - strict mode
except ValidationError as e:
    print(e)
```

---

## Advanced Features

### Discriminated Unions

```python
from typing import Literal, Union
from pydantic import BaseModel, Field, ValidationError

class Cat(BaseModel):
    pet_type: Literal['cat']
    meows: int

class Dog(BaseModel):
    pet_type: Literal['dog']
    barks: float

class Lizard(BaseModel):
    pet_type: Literal['reptile', 'lizard']
    scales: bool

class Model(BaseModel):
    pet: Union[Cat, Dog, Lizard] = Field(discriminator='pet_type')
    n: int

print(Model(pet={'pet_type': 'dog', 'barks': 3.14}, n=1))
# pet=Dog(pet_type='dog', barks=3.14) n=1
```

### Function Validation

```python
from pydantic import ValidationError, validate_call

@validate_call
def repeat(s: str, count: int, *, separator: bytes = b'') -> bytes:
    b = s.encode()
    return separator.join(b for _ in range(count))

a = repeat('hello', 3)
print(a)
# b'hellohellohello'

b = repeat('x', '4', separator=b' ')
print(b)
# b'x x x x'
```

### Integration with ORMs

```python
import sqlalchemy as sa
from sqlalchemy.orm import declarative_base
from pydantic import BaseModel, ConfigDict, Field

class MyModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    metadata: dict[str, str] = Field(alias='metadata_')

Base = declarative_base()

class MyTableModel(Base):
    __tablename__ = 'my_table'
    id = sa.Column('id', sa.Integer, primary_key=True)
    # 'metadata' is reserved by SQLAlchemy, hence the '_'
    metadata_ = sa.Column('metadata', sa.JSON)

sql_model = MyTableModel(metadata_={'key': 'val'}, id=1)
pydantic_model = MyModel.model_validate(sql_model)

print(pydantic_model.model_dump())
#> {'metadata': {'key': 'val'}}
```

---

## Additional Resources

- Trust Score: 9.6/10
- Code Snippets Available: 643
- Source: Pydantic Official Documentation (pydantic/pydantic)