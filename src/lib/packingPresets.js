// Built-in packing presets. Each entry is [category, item]. Applying a preset
// bulk-adds these to a trip, skipping anything already on the list.
export const PRESETS = {
  'Essentials': [
    ['Documents', 'Passport'], ['Documents', 'Boarding passes'], ['Documents', 'Travel insurance'],
    ['Documents', 'Cards & some cash'], ['Electronics', 'Phone charger'], ['Electronics', 'Power adapter'],
    ['Electronics', 'Portable battery'], ['Toiletries', 'Toothbrush & paste'], ['Toiletries', 'Deodorant'],
    ['Toiletries', 'Medications'], ['Clothing', 'Underwear'], ['Clothing', 'Socks'], ['Other', 'Reusable water bottle']
  ],
  'Beach / Sun': [
    ['Clothing', 'Swimwear'], ['Clothing', 'Sunhat'], ['Clothing', 'Flip-flops'], ['Clothing', 'Cover-up / kaftan'],
    ['Toiletries', 'Sunscreen'], ['Toiletries', 'After-sun'], ['Other', 'Beach towel'], ['Other', 'Sunglasses']
  ],
  'City break': [
    ['Clothing', 'Comfortable walking shoes'], ['Clothing', 'Day bag'], ['Clothing', 'A smart outfit'],
    ['Electronics', 'Portable charger'], ['Other', 'Compact umbrella'], ['Other', 'Reusable water bottle']
  ],
  'Ski / Cold': [
    ['Clothing', 'Thermal base layers'], ['Clothing', 'Ski jacket'], ['Clothing', 'Waterproof trousers'],
    ['Clothing', 'Gloves'], ['Clothing', 'Beanie / hat'], ['Clothing', 'Thermal socks'],
    ['Toiletries', 'Lip balm'], ['Toiletries', 'High-factor sunscreen']
  ],
  'Business': [
    ['Clothing', 'Suit / formalwear'], ['Clothing', 'Dress shoes'], ['Clothing', 'Shirts'],
    ['Electronics', 'Laptop & charger'], ['Documents', 'Business cards'], ['Other', 'Notebook & pen']
  ],
  'Kids / Family': [
    ['Kids', 'Nappies / wipes'], ['Kids', 'Snacks'], ['Kids', 'Favourite toy'], ['Kids', 'Spare clothes'],
    ['Kids', "Children's medication"], ['Kids', 'Tablet + headphones'], ['Kids', 'Pram / carrier']
  ]
}
