// International Space Station standard menu: nutrition per serving, transcribed from "International Space Station
// Standard Menu Nutritional Data" (Appendix A of NASA STEMonstrations Classroom Connection: Nutrition). The meal kind
// (breakfast, main, side…) is our own grouping for suggestions; NASA's table lists the foods alphabetically.

export type FoodType = 'NF' | 'B' | 'T' | 'R' | 'I' | 'IM';

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  NF: 'Natural form',
  B: 'Beverage',
  T: 'Thermostabilized',
  R: 'Rehydratable',
  I: 'Irradiated',
  IM: 'Intermediate moisture',
};

export type MealKind = 'breakfast' | 'main' | 'side' | 'soup' | 'snack' | 'fruit' | 'dessert' | 'drink';

export const MEAL_KIND_LABELS: Record<MealKind, string> = {
  breakfast: 'Breakfast',
  main: 'Mains',
  side: 'Sides',
  soup: 'Soups',
  snack: 'Snacks',
  fruit: 'Fruit',
  dessert: 'Desserts',
  drink: 'Drinks',
};

export interface Food {
  id: string;
  name: string;
  type: FoodType;
  kind: MealKind;
  /** Grams per serving as packaged (dry weight for rehydratable foods and drinks). */
  mass: number;
  kcal: number;
  /** Grams. */
  protein: number;
  carbs: number;
  fat: number;
  satFat: number;
  /** Milligrams. */
  sodium: number;
  potassium: number;
  calcium: number;
  /** Grams. */
  fiber: number;
}

// name, type, kind, mass g, kcal, protein g, carbohydrate g, fat g, saturated fat g, sodium mg, potassium mg, calcium mg, fiber g
type Row = [string, FoodType, MealKind, number, number, number, number, number, number, number, number, number, number];

const ROWS: Row[] = [
  // Breakfast
  ['Bran Chex', 'R', 'breakfast', 40, 135, 5, 31, 0.19, 0, 246, 276, 193, 3.2],
  ['Cornflakes', 'R', 'breakfast', 40, 147.6, 4.5, 32.8, 0.05, 0, 210.7, 172.6, 110.7, 0.5],
  ['Granola', 'R', 'breakfast', 80, 313, 10.42, 58, 6, 0.74, 173, 405, 140, 4],
  ['Oatmeal w/ Brown Sugar', 'R', 'breakfast', 46.1, 170, 5, 35, 1.8, 0.4, 233, 178, 134, 1.7],
  ['Oatmeal w/ Raisins & Spice', 'R', 'breakfast', 47.2, 162, 3.2, 38, 0.9, 0, 307, 185, 146, 2.5],
  ['Scrambled Eggs', 'R', 'breakfast', 34.5, 183, 13, 6, 12, 6, 333.3, 254, 128, 0.91],
  ['Mexican Scrambled Eggs', 'R', 'breakfast', 36, 202, 14, 7, 13.5, 6.55, 345.7, 266, 144, 0],
  ['Breakfast Sausage Links', 'I', 'breakfast', 70, 155, 11.71, 4.7, 9.9, 3.78, 614.6, 209.37, 8.61, 0],
  ['Grits w/ Butter', 'R', 'breakfast', 34.5, 117, 2.3, 27, 0.3, 0, 509.2, 56, 127, 0.8],
  ['Waffles', 'NF', 'breakfast', 43, 208, 3, 23, 12, 2.6, 100, 53, 18, 0.5],
  ['Vegetable Quiche', 'R', 'breakfast', 50, 271, 15.5, 13, 18, 11.5, 462, 418, 339, 1.3],
  // Mains
  ['Barbecued Beef Brisket', 'I', 'main', 118, 231, 29, 14, 6.6, 2.42, 514, 465, 12, 0],
  ['Beef Fajitas', 'I', 'main', 125, 187, 31, 8, 4.8, 2, 841, 500, 23, 3],
  ['Beef Steak', 'I', 'main', 100, 208, 27, 1, 10.86, 4.7, 492.3, 416, 5.4, 0],
  ['Beef Tips w/ Mushrooms', 'I', 'main', 138, 182.2, 30.9, 7.1, 5.2, 2.2, 419.9, 343.9, 35.1, 4.3],
  ['Cheese Tortellini', 'T', 'main', 227, 216, 10, 46, 2.25, 0, 487, 466, 192, 7.72],
  ['Chicken Fajitas', 'T', 'main', 142, 168.9, 27.4, 9.1, 4.1, 0.53, 487.4, 550.2, 18.1, 3.4],
  ['Chicken Teriyaki', 'I', 'main', 120, 150, 27, 8, 1, 0, 1140, 540, 21, 0],
  ['Chicken w/ Peanut Sauce', 'T', 'main', 198, 214, 25, 18, 5.56, 3, 393.2, 530, 42, 2.1],
  ['Fiesta Chicken', 'T', 'main', 227, 220, 23, 16, 8.8, 3, 700.8, 575, 128, 3.2],
  ['Grilled Pork Chop', 'T', 'main', 142, 261, 32.5, 3.7, 13, 5, 281, 530.5, 10.5, 0],
  ['Lasagna with Meat', 'T', 'main', 227, 202, 20, 31.7, 5.4, 3, 788, 576, 204, 13],
  ['Macaroni & Cheese', 'R', 'main', 40, 194, 8.5, 20, 9.23, 4.8, 643.6, 101, 152, 1.23],
  ['Meatloaf', 'T', 'main', 119, 177.3, 17.3, 16.4, 4.7, 2.2, 698.6, 499.4, 22.5, 0],
  ['Noodles & Chicken', 'R', 'main', 28, 105, 4.2, 18.9, 1.7, 0.5, 552.7, 98, 12, 0.83],
  ['Pasta w/ Pesto Sauce', 'T', 'main', 114, 124, 7, 25, 0.5, 0, 337, 62, 40, 2.5],
  ['Red Beans & Rice', 'T', 'main', 227, 159, 10, 36, 0.45, 0, 292.4, 624, 61, 7.9],
  ['Salmon', 'T', 'main', 74, 85, 16, 1.74, 1.5, 0.5, 372, 255, 22, 0],
  ['Seafood Gumbo', 'T', 'main', 198, 129, 13, 10.55, 4.5, 2, 293, 471, 55, 1.92],
  ['Shrimp Cocktail', 'R', 'main', 35, 117.95, 14.14, 13.74, 0.7, 0.16, 705.25, 217.32, 50.75, 1.4],
  ['Smoked Turkey', 'I', 'main', 90, 108, 19, 0.44, 3, 1.3, 757, 248, 4, 0],
  ['Sweet & Sour Chicken', 'R', 'main', 36, 144, 21, 11, 2, 0.3, 223.7, 263, 5, 0.3],
  ['Teriyaki Beef Steak', 'I', 'main', 120, 234, 39, 4, 6.8, 2.7, 863, 550, 12, 0],
  ['Teriyaki Chicken', 'R', 'main', 37, 142, 23, 9, 1.8, 0.9, 977.2, 290, 18, 0.23],
  ['Tofu w/ Hoisin Sauce', 'T', 'main', 142, 125, 12, 17.8, 1.5, 0, 660.4, 305.2, 65.6, 1.8],
  ['Tuna', 'T', 'main', 74, 79, 17, 2, 0, 0, 118, 275, 3, 0],
  // Sides
  ['Baked Beans', 'T', 'side', 142, 158, 7, 37, 0.65, 0, 298, 293, 80, 6],
  ['Black Beans', 'T', 'side', 170, 114, 9, 26, 0.66, 0, 271, 635, 72, 8],
  ['Broccoli au Gratin', 'R', 'side', 30, 124, 4.8, 14, 7, 4, 740.4, 370, 120.5, 3.6],
  ['Brown Rice', 'T', 'side', 121, 161, 3, 37, 0.86, 0, 62, 127, 10, 1.8],
  ['Carrot Coins', 'T', 'side', 127, 42.5, 1.2, 11.6, 0.53, 0, 80, 211.3, 37, 3.3],
  ['Cauliflower w/ Cheese', 'R', 'side', 16, 55, 2.6, 9, 2.3, 1.1, 473, 263, 50.5, 2.7],
  ['Curry Sauce w/ Vegetables', 'T', 'side', 184, 107, 1.5, 23, 2.2, 2, 287, 504, 35, 3],
  ['Green Beans w/ Mushrooms', 'R', 'side', 10, 22, 1.8, 7, 0.2, 0, 178, 79, 40, 3.2],
  ['Homestyle Potatoes', 'T', 'side', 142, 160, 3.5, 30, 6, 1.5, 225, 656, 25, 7],
  ['Italian Vegetables', 'R', 'side', 20, 92, 2.1, 10.14, 5.93, 0.7, 250, 141.4, 22.34, 2.6],
  ['Mashed Potatoes', 'R', 'side', 22, 71, 2, 16, 0.9, 0.23, 331, 362, 8.3, 2.1],
  ['Mixed Vegetables', 'T', 'side', 113, 57, 3.4, 12.5, 1.3, 0, 47, 249, 25, 4.6],
  ['Potato Medley', 'T', 'side', 142, 139, 2.4, 30.2, 2.8, 1, 73.3, 566.6, 21.6, 4.09],
  ['Rice Pilaf', 'R', 'side', 25, 103, 2, 20, 1.8, 1.2, 369, 48, 20, 0.5],
  ['Tortillas', 'NF', 'side', 60, 189, 5, 34, 4, 1, 421, 132, 74, 1],
  ['Wheat Flat Bread', 'NF', 'side', 57, 194, 5, 33, 5, 1, 381, 86, 160, 1.6],
  // Soups
  ['Chicken Consomme', 'B', 'soup', 6.7, 14, 0.13, 2.4, 0.4, 0, 1399, 14, 79, 0],
  ['Chicken Noodle Soup', 'T', 'soup', 227, 134, 17.4, 14.8, 1.36, 0, 345.7, 295, 35, 1.66],
  ['Cream of Mushroom Soup', 'R', 'soup', 27, 141, 2.9, 12, 10, 6.4, 852.7, 139, 62, 0.7],
  ['Hot and Sour Soup', 'T', 'soup', 170, 54.4, 7.8, 9.8, 0.99, 0, 299.5, 184, 25, 0.99],
  ['Minestrone Soup', 'T', 'soup', 227, 84, 3.09, 16.3, 2, 0, 251.3, 462.9, 53.8, 2.6],
  ['Split Pea Soup', 'T', 'soup', 227, 180, 14, 33, 1.23, 0, 283, 515, 30, 4.65],
  ['Tomato Basil Soup', 'T', 'soup', 170, 54.4, 2.4, 8.9, 1.9, 0, 535.3, 451.9, 76.8, 2.1],
  ['Vegetarian Vegetable Soup', 'T', 'soup', 227, 95, 2, 23, 0.3, 0, 389, 363, 29, 1.7],
  // Snacks
  ['Almonds', 'NF', 'snack', 45, 243, 11, 11, 20, 1.8, 1.67, 343, 126, 6.5],
  ['Butter Cookies', 'NF', 'snack', 34, 150, 2, 22, 6, 4, 59, 41, 6, 0.54],
  ['Candy Coated Almonds', 'NF', 'snack', 45, 230, 4, 27, 12, 3.8, 18, 162, 68, 1.5],
  ['Cashews', 'NF', 'snack', 45, 265, 10, 13, 20, 4, 4.8, 324, 16, 1.5],
  ['Granola Bar', 'NF', 'snack', 28, 120, 1.4, 20, 4.2, 2.8, 51, 65, 12, 0.81],
  ['Macadamia Nuts', 'NF', 'snack', 45, 308, 3.6, 11, 29, 4.7, 4.14, 181, 19, 3],
  ['Nut & Fruit Granola Bar', 'NF', 'snack', 35, 135, 2.9, 24, 3.9, 0.4, 90.23, 90, 204, 2],
  ['Peanut Butter', 'T', 'snack', 32, 205, 8, 5.5, 17, 4.4, 2.4, 234, 15, 1.3],
  ['Trail Mix', 'IM', 'snack', 50, 215, 4, 33, 8.6, 2.8, 29, 126, 18, 2],
  ['Yogurt Covered Granola Bar', 'NF', 'snack', 35, 159, 3.9, 20, 7.5, 2.3, 125.5, 111, 46, 3],
  // Fruit
  ['Applesauce', 'T', 'fruit', 128, 132, 0.13, 34, 0.05, 0, 9.22, 61, 4.6, 1.5],
  ['Berry Medley', 'R', 'fruit', 31, 105, 1, 27, 0, 0, 1.1, 165, 26, 2.3],
  ['Citrus Fruit Salad', 'T', 'fruit', 142, 70, 0.81, 17, 0.14, 0, 6.8, 175, 21.6, 0.98],
  ['Dried Apricots', 'IM', 'fruit', 62, 156, 3.7, 38, 0.16, 0, 13, 760, 26, 3.3],
  ['Dried Peaches', 'IM', 'fruit', 62, 131, 2, 35, 0.15, 0, 2, 608, 14, 4.5],
  ['Fruit Cocktail', 'T', 'fruit', 128, 81, 0, 21, 0, 0, 35, 109, 6, 1],
  ['Peaches', 'T', 'fruit', 153, 75, 0.64, 20, 0.11, 0, 6.9, 241, 8.1, 2.46],
  ['Pears', 'T', 'fruit', 128, 61, 0.24, 15, 0.12, 0, 3.5, 46, 5, 0.6],
  ['Pineapple', 'T', 'fruit', 128, 91, 0.5, 23.8, 0.04, 0, 63.5, 156, 18, 1.7],
  ['Strawberries', 'R', 'fruit', 28, 89, 1, 23, 0, 0, 7, 204, 28, 1.6],
  ['Tropical Fruit Salad', 'T', 'fruit', 142, 81, 0.37, 21, 0.08, 0, 12, 85, 37, 1.9],
  // Desserts
  ['Chocolate Pudding', 'T', 'dessert', 114, 124, 2.3, 27, 1, 0, 117, 163, 61, 0.8],
  ['Cranapple Dessert', 'T', 'dessert', 177, 144, 2.42, 29, 4.1, 1, 43.4, 183, 37, 4.8],
  ['Brownie', 'NF', 'dessert', 61, 268, 2, 41, 10.94, 3, 116, 86, 14.9, 1.08],
  ['Vanilla Pudding', 'T', 'dessert', 114, 128, 2, 29, 0.63, 0, 156, 109, 68, 0],
  // Drinks
  ['Cocoa', 'B', 'drink', 50.5, 165.6, 2.7, 43.9, 1.1, 0.55, 152.2, 523, 51.3, 7.6],
  ['Grape Drink', 'B', 'drink', 17, 66.3, 0, 16.6, 0, 0, 0.2, 0, 28.8, 0],
  ['Kona Coffee Black', 'B', 'drink', 1.5, 4.3, 0.2, 1, 0, 0, 0.2, 61.4, 2.4, 0.2],
  ['Lemonade', 'B', 'drink', 21, 81, 0, 20, 0, 0, 30, 1.6, 3.3, 0],
  ['Mango Peach Smoothie', 'B', 'drink', 50, 200, 1.3, 46, 1.2, 1.1, 57, 136, 66, 0],
  ['Orange Drink', 'B', 'drink', 11.9, 43, 0.02, 11, 0, 0, 2.4, 2.1, 107.5, 0],
  ['Orange Juice', 'B', 'drink', 35, 123.6, 1.6, 29.2, 0, 0, 8.3, 438.8, 21.3, 0.8],
  ['Vanilla Breakfast Drink', 'B', 'drink', 38.8, 136, 7.5, 27, 0, 0, 168.3, 77, 681, 0.3],
];

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/w\//g, 'with ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const ISS_MENU: Food[] = ROWS.map(([name, type, kind, mass, kcal, protein, carbs, fat, satFat, sodium, potassium, calcium, fiber]) => ({
  id: slug(name),
  name,
  type,
  kind,
  mass,
  kcal,
  protein,
  carbs,
  fat,
  satFat,
  sodium,
  potassium,
  calcium,
  fiber,
}));

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(ISS_MENU.map((f) => [f.id, f]));
