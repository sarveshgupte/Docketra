1. **Optimize `countCategories` method in `src/repositories/category.repository.js`**
   - The user instruction mentions "When optimizing boolean presence checks in MongoDB (e.g., count > 0), use `Model.exists(query)` instead of `Model.countDocuments(query)`".
   - We will find instances of `countDocuments` that are used in `> 0` comparisons and replace them with `exists`.
   - Let's look at `src/services/user.service.js` or `src/controllers/user.controller.js` and find a good candidate.
   - Wait, `firmSetup.service.js` has `Category.countDocuments({ firmId }).session(activeSession) > 0`? No, let's search for `countDocuments` again.
