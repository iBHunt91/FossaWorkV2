# Sequential Thinking Tool

The Sequential Thinking tool provides a structured approach to problem-solving through a series of connected thoughts. It allows for dynamic, reflective thinking that can adapt as understanding evolves.

## Usage

```
/sequential_thinking <problem statement>
```

This command will invoke a step-by-step thinking process to analyze and solve the specified problem.

## Features

- Break down complex problems into manageable steps
- Revise previous thoughts as new information emerges
- Branch into alternative thinking paths when needed
- Adjust the number of steps dynamically
- Express uncertainty and explore multiple approaches

## Parameters

- `thought`: Current thinking step (required)
- `nextThoughtNeeded`: Boolean indicating if more thinking is needed (required)
- `thoughtNumber`: Current position in sequence (required)
- `totalThoughts`: Estimated total thoughts needed (required)
- `isRevision`: Whether this revises previous thinking (optional)
- `revisesThought`: Which thought number is being reconsidered (optional)
- `branchFromThought`: Thought number serving as branching point (optional)
- `branchId`: Identifier for the current branch (optional)
- `needsMoreThoughts`: If reaching end but requiring additional thinking (optional)

## When to Use

- Complex problem analysis requiring multiple steps
- Planning tasks with potential for course correction
- Situations where full scope isn't initially clear
- Projects needing context maintenance across steps
- Problems benefiting from filtering irrelevant information
- Hypothetical scenarios requiring detailed exploration

## Example

```
/sequential_thinking How should we redesign our application's notification system?
```

This would start a multi-step thinking process about notification system redesign, considering requirements, constraints, and potential solutions.