"""Strict HTTP contracts. Commands and explanations are always inert text."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Profile = Literal['linux', 'macos']


class Contract(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class ProposalRequest(Contract):
    request: str = Field(min_length=1, max_length=2000)
    profile: Profile = 'linux'
    recipe_id: str | None = Field(default=None, max_length=50)
    parameters: dict[str, str] = Field(default_factory=dict, max_length=5)

    @field_validator('request')
    @classmethod
    def request_text(cls, value: str) -> str:
        if not value.strip() or any(ord(c) < 32 and c not in '\n\t' for c in value):
            raise ValueError('Provide nonempty text without control characters')
        return value.strip()

    @model_validator(mode='after')
    def parameters_need_recipe(self):
        if self.parameters and not self.recipe_id:
            raise ValueError('Parameters require a recipe_id')
        return self


class AnalysisRequest(Contract):
    command: str = Field(min_length=1, max_length=4000)
    profile: Profile = 'linux'

    @field_validator('command')
    @classmethod
    def command_text(cls, value: str) -> str:
        if not value.strip() or '\x00' in value:
            raise ValueError('Provide a nonempty command without NUL bytes')
        return value


class Intent(Contract):
    operation: str
    target: str
    conditions: list[str] = Field(default_factory=list)
    threshold: int | None = None
    units: str | None = None
    exclusions: list[str] = Field(default_factory=list)
    platform: Profile
    scope: str
    expected_side_effects: str = 'None intended; no command is executed'
    missing_information: list[str] = Field(default_factory=list)


class Token(Contract):
    text: str
    start: int
    end: int
    role: str
    explanation: str
    implication: str
    constraint: str | None = None
    supported: bool


class Safety(Contract):
    risk: Literal['SAFE', 'CAUTION', 'DANGEROUS']
    syntax_valid: bool
    reasons: list[str]
    policy: str


class Receipt(Contract):
    status: Literal['proposed', 'analyzed', 'unsupported', 'needs_clarification']
    request: str
    profile: Profile
    command: str | None = None
    backend: str
    message: str
    intent: Intent | None = None
    safety: Safety | None = None
    tokens: list[Token] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    clarification: str | None = None
    executed: Literal[False] = False
    requires_manual_review: Literal[True] = True
    limitations: list[str] = Field(default_factory=lambda: [
        'Bash syntax validity does not establish intent correctness.',
        'SAFE is a static allowlist classification, never a runtime safety guarantee.',
        'No filesystem was inspected. Permissions, symlinks, utility versions and data are unknown.',
    ])


class RecipeParameter(Contract):
    name: str
    label: str
    default: str


class Recipe(Contract):
    id: str
    title: str
    category: str
    description: str
    request: str
    command: str
    profiles: list[Profile]
    compatibility: str
    parameters: list[RecipeParameter] = Field(default_factory=list)
