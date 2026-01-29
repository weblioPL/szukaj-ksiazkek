import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create categories
  const categories = [
    { name: 'Biznes i ekonomia', slug: 'biznes-i-ekonomia', description: 'Książki o biznesie, finansach i ekonomii' },
    { name: 'Rozwój osobisty', slug: 'rozwoj-osobisty', description: 'Samodoskonalenie i motywacja' },
    { name: 'Literatura piękna', slug: 'literatura-piekna', description: 'Powieści i proza literacka' },
    { name: 'Kryminał i thriller', slug: 'kryminal-i-thriller', description: 'Książki kryminalne i sensacyjne' },
    { name: 'Science fiction i fantasy', slug: 'science-fiction-i-fantasy', description: 'Fantastyka i science fiction' },
    { name: 'Historia', slug: 'historia', description: 'Książki historyczne' },
    { name: 'Biografia', slug: 'biografia', description: 'Biografie i autobiografie' },
    { name: 'Nauka i technika', slug: 'nauka-i-technika', description: 'Popularnonaukowe i techniczne' },
    { name: 'Psychologia', slug: 'psychologia', description: 'Psychologia i psychiatria' },
    { name: 'Zdrowie i uroda', slug: 'zdrowie-i-uroda', description: 'Poradniki zdrowotne' },
    { name: 'Poradniki', slug: 'poradniki', description: 'Poradniki i how-to' },
    { name: 'Dla dzieci', slug: 'dla-dzieci', description: 'Literatura dziecięca' },
    { name: 'Młodzieżowe', slug: 'mlodziezowe', description: 'Książki dla młodzieży' },
    { name: 'Komiksy i manga', slug: 'komiksy-i-manga', description: 'Komiksy i manga' },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
  }
  console.log(`✅ Created ${categories.length} categories`);

  // Create sample authors
  const authors = [
    { name: 'James Clear', bio: 'Autor bestsellera "Atomowe nawyki"' },
    { name: 'Cal Newport', bio: 'Profesor informatyki i autor książek o produktywności' },
    { name: 'Daniel Kahneman', bio: 'Laureat Nagrody Nobla w dziedzinie ekonomii' },
    { name: 'Yuval Noah Harari', bio: 'Historyk i autor "Sapiens"' },
    { name: 'Olga Tokarczuk', bio: 'Polska pisarka, laureatka Nagrody Nobla w dziedzinie literatury' },
    { name: 'Andrzej Sapkowski', bio: 'Polski pisarz fantasy, twórca "Wiedźmina"' },
    { name: 'Remigiusz Mróz', slug: 'remigiusz-mroz', bio: 'Polski pisarz kryminałów' },
  ];

  const createdAuthors: Record<string, string> = {};
  for (const author of authors) {
    const created = await prisma.author.upsert({
      where: { id: author.name.toLowerCase().replace(/\s/g, '-') },
      update: {},
      create: {
        name: author.name,
        bio: author.bio,
      },
    });
    createdAuthors[author.name] = created.id;
  }
  console.log(`✅ Created ${authors.length} authors`);

  // Create sample books
  const books = [
    {
      isbn: '9788328372801',
      title: 'Atomowe nawyki',
      description: 'Drobne zmiany, niezwykłe efekty. Praktyczny przewodnik po budowaniu dobrych nawyków.',
      publisher: 'Galaktyka',
      pageCount: 320,
      hasPaper: true,
      hasEbook: true,
      hasAudiobook: true,
      authorName: 'James Clear',
      categorySlug: 'rozwoj-osobisty',
    },
    {
      isbn: '9788380322516',
      title: 'Praca głęboka',
      description: 'Jak odnieść sukces w świecie, który ciągle rozprasza.',
      publisher: 'Studio Emka',
      pageCount: 296,
      hasPaper: true,
      hasEbook: true,
      hasAudiobook: true,
      authorName: 'Cal Newport',
      categorySlug: 'rozwoj-osobisty',
    },
    {
      isbn: '9788372296078',
      title: 'Pułapki myślenia',
      description: 'O myśleniu szybkim i wolnym.',
      publisher: 'Media Rodzina',
      pageCount: 596,
      hasPaper: true,
      hasEbook: true,
      hasAudiobook: false,
      authorName: 'Daniel Kahneman',
      categorySlug: 'psychologia',
    },
    {
      isbn: '9788308063842',
      title: 'Sapiens. Od zwierząt do bogów',
      description: 'Krótka historia ludzkości.',
      publisher: 'Wydawnictwo Literackie',
      pageCount: 512,
      hasPaper: true,
      hasEbook: true,
      hasAudiobook: true,
      authorName: 'Yuval Noah Harari',
      categorySlug: 'historia',
    },
    {
      isbn: '9788308062760',
      title: 'Bieguni',
      description: 'Powieść nagrodzona Bookerem i Noblem.',
      publisher: 'Wydawnictwo Literackie',
      pageCount: 424,
      hasPaper: true,
      hasEbook: true,
      hasAudiobook: false,
      authorName: 'Olga Tokarczuk',
      categorySlug: 'literatura-piekna',
    },
    {
      isbn: '9788375780635',
      title: 'Wiedźmin. Ostatnie życzenie',
      description: 'Pierwszy tom sagi o Wiedźminie.',
      publisher: 'SuperNOWA',
      pageCount: 332,
      hasPaper: true,
      hasEbook: true,
      hasAudiobook: true,
      authorName: 'Andrzej Sapkowski',
      categorySlug: 'science-fiction-i-fantasy',
    },
  ];

  for (const book of books) {
    const { authorName, categorySlug, ...bookData } = book;
    const category = await prisma.category.findUnique({ where: { slug: categorySlug } });

    if (!category) continue;

    const created = await prisma.book.upsert({
      where: { isbn: book.isbn },
      update: {},
      create: {
        ...bookData,
        avgRating: Math.random() * 2 + 3, // Random rating 3-5
        ratingsCount: Math.floor(Math.random() * 1000) + 100,
      },
    });

    // Link author
    if (createdAuthors[authorName]) {
      await prisma.bookAuthor.upsert({
        where: {
          bookId_authorId: {
            bookId: created.id,
            authorId: createdAuthors[authorName],
          },
        },
        update: {},
        create: {
          bookId: created.id,
          authorId: createdAuthors[authorName],
          role: 'author',
        },
      });
    }

    // Link category
    await prisma.bookCategory.upsert({
      where: {
        bookId_categoryId: {
          bookId: created.id,
          categoryId: category.id,
        },
      },
      update: {},
      create: {
        bookId: created.id,
        categoryId: category.id,
      },
    });
  }
  console.log(`✅ Created ${books.length} sample books`);

  // Create a test user
  const passwordHash = await bcrypt.hash('Test123!', 12);
  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      passwordHash,
      name: 'Test User',
      isVerified: true,
    },
  });
  console.log('✅ Created test user (test@example.com / Test123!)');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
