const titleFeatures = {
  in: ["body"],
  trim: true,
  notEmpty: {
    errorMessage: "The item should not be empty!",
  },
  isLength: {
    options: {
      min: 5,
      max: 100,
    },
    errorMessage: "The item should have from 5 to 100 characters!",
  },
};

export const titleAddValidationSchema = {
  newItem: titleFeatures,
};

export const titleUpdateValidationSchema = {
  updatedItemTitle: titleFeatures,
};
