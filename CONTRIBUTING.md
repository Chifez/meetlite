# Contributing to MeetLite

We welcome contributions! Please follow these guidelines to ensure a smooth contribution process.

## 🤝 Contribution Process

1. **Fork the repository**
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** following our coding standards
4. **Write/update tests** if applicable
5. **Commit your changes** with clear messages:
   ```bash
   git commit -m "feat: add new feature"
   ```
6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
7. **Open a Pull Request** with a clear description

## 📝 Coding Standards

### TypeScript & JavaScript

- **TypeScript**: Use TypeScript for all new code
- **ESLint**: Follow the project's ESLint configuration
- **Code Style**: Use Prettier for formatting
- **Type Safety**: Always use proper types, avoid `any` when possible

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, missing semicolons, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks, dependency updates
- `perf:` Performance improvements
- `ci:` CI/CD changes

**Example:**

```bash
git commit -m "feat: add organization-level asset tracking"
git commit -m "fix: resolve connection issue in integrations beam"
git commit -m "docs: update API documentation"
```

## 🛠️ Development Guidelines

### Component Structure

- **Keep components small and focused**: Each component should have a single responsibility
- **Use TypeScript interfaces**: Define clear prop types for all components
- **Extract reusable logic**: Use custom hooks for shared functionality
- **Follow naming conventions**: Use PascalCase for components, camelCase for functions

### State Management

- **Zustand for global state**: Use Zustand stores for application-wide state
- **Local state for component-specific data**: Use `useState` for component-specific state
- **Avoid prop drilling**: Use context or Zustand when passing data through multiple levels

### API Calls

- **Use service classes**: All API calls should go through service classes in `src/services/`
- **Error handling**: Always handle errors gracefully with user-friendly messages
- **Loading states**: Show loading indicators during async operations
- **Type safety**: Use TypeScript interfaces for API responses

### Error Handling

- **Always handle errors gracefully**: Never let errors crash the application
- **User-friendly messages**: Show clear, actionable error messages
- **Logging**: Log errors appropriately for debugging (console.error in development)
- **Toast notifications**: Use Sonner for user-facing error messages

### Accessibility

- **Follow WCAG guidelines**: Ensure your code is accessible
- **Keyboard navigation**: Support keyboard-only navigation
- **Screen readers**: Use proper ARIA labels and semantic HTML
- **Color contrast**: Ensure sufficient color contrast for text

### Performance

- **Optimize bundle size**: Avoid unnecessary dependencies
- **Code splitting**: Use React.lazy for route-based code splitting
- **Memoization**: Use `useMemo` and `useCallback` appropriately
- **Avoid unnecessary re-renders**: Optimize component dependencies

## 📋 Pull Request Guidelines

### PR Title

- Use clear, descriptive titles
- Start with the type (feat, fix, docs, etc.)
- Keep it concise but informative

**Examples:**

- `feat: add team-level asset tracking`
- `fix: resolve modal closing during async operations`
- `docs: update architecture documentation`

### PR Description

Your PR description should include:

1. **What**: Clear description of what the PR does
2. **Why**: Explanation of why this change is needed
3. **How**: Brief overview of the implementation approach
4. **Testing**: Description of how you tested the changes
5. **Screenshots**: Include screenshots for UI changes
6. **Breaking Changes**: Clearly mark any breaking changes

**Template:**

```markdown
## Description

Brief description of what this PR does.

## Why

Why is this change needed?

## Changes

- Change 1
- Change 2
- Change 3

## Testing

How was this tested?

- [ ] Manual testing
- [ ] Unit tests
- [ ] Integration tests

## Screenshots

(If applicable)

## Breaking Changes

(If any)
```

### Code Review

- **All PRs require at least one approval** before merging
- **Address review comments promptly**: Respond to feedback and make requested changes
- **Keep PRs focused**: One feature or fix per PR when possible
- **Respond constructively**: Be open to feedback and suggestions
- **Update PR description**: Keep it updated as you make changes

### PR Size

- **Keep PRs small and focused**: Easier to review and less likely to introduce bugs
- **Break large features into smaller PRs**: Submit incremental changes
- **If a PR is too large**: Consider breaking it into multiple PRs

## 🐛 Reporting Issues

### Before Reporting

1. **Check existing issues**: Search for similar issues before creating a new one
2. **Check documentation**: Ensure the issue isn't covered in the docs
3. **Try to reproduce**: Make sure you can consistently reproduce the issue

### Issue Template

When reporting an issue, include:

- **Clear description**: What happened vs. what you expected
- **Steps to reproduce**: Detailed steps to reproduce the issue
- **Environment details**:
  - OS and version
  - Node.js version
  - Browser and version (if frontend issue)
  - Package versions
- **Screenshots/Logs**: Include relevant screenshots or error logs
- **Possible solution**: If you have ideas on how to fix it

**Example:**

```markdown
## Description

Brief description of the issue.

## Steps to Reproduce

1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior

What you expected to happen.

## Actual Behavior

What actually happened.

## Environment

- OS: macOS 14.0
- Node.js: 20.10.0
- Browser: Chrome 120.0
- Version: 1.0.0

## Screenshots

(If applicable)

## Additional Context

Any other relevant information.
```

## 🧪 Testing

### Writing Tests

- **Test critical paths**: Focus on testing important functionality
- **Test edge cases**: Don't just test the happy path
- **Keep tests simple**: Each test should verify one thing
- **Use descriptive test names**: Test names should clearly describe what they test

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

## 📚 Getting Help

### Resources

- **Check existing issues and PRs**: Your question might already be answered
- **Review documentation**: Check the README and other docs
- **Ask in discussions**: Use GitHub Discussions for questions
- **Be respectful and patient**: Maintain a positive, collaborative environment

### Communication

- **Be clear and concise**: Make it easy for others to help you
- **Provide context**: Include relevant code, error messages, and environment details
- **Be patient**: Maintainers and contributors are volunteers
- **Be respectful**: Follow the code of conduct

## 🔍 Code Review Checklist

Before submitting a PR, ensure:

- [ ] Code follows the project's coding standards
- [ ] All tests pass
- [ ] New features have tests
- [ ] Documentation is updated (if needed)
- [ ] No console.logs or debug code
- [ ] Error handling is implemented
- [ ] Accessibility considerations are met
- [ ] Performance is considered
- [ ] No breaking changes (or clearly documented)

## 🎯 Areas for Contribution

We welcome contributions in these areas:

- **Bug fixes**: Fix reported bugs
- **New features**: Implement requested features
- **Documentation**: Improve docs and add examples
- **Tests**: Add or improve test coverage
- **Performance**: Optimize slow code
- **Accessibility**: Improve accessibility
- **UI/UX**: Enhance user interface and experience
- **Refactoring**: Improve code quality

## 📄 License

By contributing to MeetLite, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to MeetLite! 🎉
