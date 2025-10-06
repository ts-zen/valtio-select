# Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Write** tests for your changes
4. **Ensure** all tests pass: `bun test`
5. **Run** type checks: `bun run type-check`
6. **Commit** your changes: `git commit -m 'Add amazing feature'`
7. **Push** to the branch: `git push origin feature/amazing-feature`
8. **Open** a Pull Request

## Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/valtio-select.git

# Install dependencies
bun install

# Run tests
bun test:ts

# Run tests for types
bun test:types

# Type check
bun run check

# Type check resolution
bun run check:write

# Build
bun run build
```
