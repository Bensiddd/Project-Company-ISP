export const mockServicePackages = [
  {
    id: 1,
    name: 'Starter',
    description: 'Cocok untuk rumah tangga dengan kebutuhan internet harian. Browsing, streaming, dan media sosial lancar tanpa hambatan.',
    type: 'monthly',
    price: 160000,
    bandwidth: '10 Mbps',
    features: ['Fiber Optik', 'WiFi Router Gratis', 'Support 24/7', 'Instalasi Gratis', 'No FUP'],
    is_active: true
  },
  {
    id: 2,
    name: 'Professional',
    description: 'Untuk keluarga atau usaha kecil yang butuh koneksi lebih kencang dan stabil. Cocok untuk WFH dan meeting online.',
    type: 'monthly',
    price: 400000,
    bandwidth: '50 Mbps',
    features: ['Fiber Optik', 'Static IP', 'WiFi 6 Router', 'Priority Support', 'Instalasi Gratis', 'No FUP'],
    is_active: true,
    popular: true
  },
  {
    id: 3,
    name: 'Enterprise',
    description: 'Solusi dedicated untuk perusahaan, kantor, dan organisasi. Bandwidth penuh, prioritas tertinggi, dan dukungan teknis 24 jam.',
    type: 'dedicated',
    price: null,
    bandwidth: 'Custom',
    features: ['Bandwidth Dedicated', 'SLA Guarantee', '24/7 On-site Support', 'Static IP Multiple', 'Managed Router', 'On-premise Maintenance'],
    is_active: true
  }
];

export const mockTestimonials = [
  {
    id: 1,
    author_name: 'Ahmad Fauzi',
    author_position: 'Warga Perumahan Grand Wisata',
    content: 'Setelah pindah ke MAZNET, internet di rumah jadi jauh lebih stabil. Anak-anak bisa streaming dan saya WFH tanpa kendala.',
    rating: 5,
    is_approved: true,
    published_at: '2024-01-15',
    client: { company_name: 'Grand Wisata Residence', industry: 'Residential' }
  },
  {
    id: 2,
    author_name: 'Siti Rahmawati',
    author_position: 'Pemilik Toko Serba Ada',
    content: 'Paket Professional MAZNET sangat membantu bisnis online saya. Upload produk dan live streaming jualan jadi super cepat!',
    rating: 5,
    is_approved: true,
    published_at: '2024-02-20',
    client: { company_name: 'Toko Serba Ada', industry: 'Retail' }
  },
  {
    id: 3,
    author_name: 'Rudi Hermawan',
    author_position: 'Ketua RT 03/07, Bekasi Timur',
    content: 'Kerjasama dengan MAZNET untuk jaringan RT kami sangat memuaskan. Respon teknis cepat, harga terjangkau untuk warga.',
    rating: 5,
    is_approved: true,
    published_at: '2024-03-10',
    client: { company_name: 'RT 03/07 Bekasi Timur', industry: 'Community' }
  },
  {
    id: 4,
    author_name: 'Dewi Lestari',
    author_position: 'Guru SMPN 1 Bekasi',
    content: 'Internet MAZNET sangat membantu proses belajar mengajar online di sekolah kami. Siswa jadi lebih semangat!',
    rating: 5,
    is_approved: true,
    published_at: '2024-04-05',
    client: { company_name: 'SMPN 1 Bekasi', industry: 'Education' }
  },
  {
    id: 5,
    author_name: 'Hendra Gunawan',
    author_position: 'Pemilik Warnet Cemerlang',
    content: 'Paket Dedicated MAZNET jadi andalan warnet saya. 20 PC jalan lancar tanpa lag, pelanggan puas!',
    rating: 5,
    is_approved: true,
    published_at: '2024-05-12',
    client: { company_name: 'Warnet Cemerlang', industry: 'Retail' },
    client_id: 6
  },
  {
    id: 6,
    author_name: 'dr. Fitriani',
    author_position: 'Pemilik Klinik Sehat Bersama',
    content: 'Koneksi internet MAZNET stabil untuk telemedicine dan sistem antrian online klinik kami. Sangat membantu.',
    rating: 4,
    is_approved: true,
    published_at: '2024-06-20',
    client: { company_name: 'Klinik Sehat Bersama', industry: 'Healthcare' },
    client_id: 5
  }
];

export const mockCoverageAreas = [
  { id: 1, name: 'Kabupaten Bekasi', description: 'Pusat layanan utama MAZNET dengan jangkauan fiber optik terluas.', is_active: true },
  { id: 2, name: 'Wanasari', description: 'Wilayah padat penduduk dengan kebutuhan internet tinggi untuk WFH dan sekolah online.', is_active: true },
  { id: 3, name: 'Wanajaya', description: 'Area pengembangan baru dengan potensi besar untuk layanan internet fiber optik.', is_active: true },
  { id: 4, name: 'Selang', description: 'Kawasan strategis dengan banyak UMKM dan bisnis rumahan yang butuh internet cepat.', is_active: true }
];

export const mockBlogPosts = [
  {
    id: 1,
    title: 'Tips Memilih Paket Internet untuk Remote Working',
    slug: 'tips-memilih-paket-internet-remote-working',
    excerpt: 'Panduan lengkap memilih paket internet yang tepat untuk bekerja dari rumah. Mulai dari kecepatan hingga stabilitas koneksi.',
    author_id: 1,
    status: 'published',
    published_at: '2024-03-15',
    category: 'Tips & Trik',
    author: { full_name: 'Admin MAZNET' },
    read_time: '5 min read'
  },
  {
    id: 2,
    title: 'Perbedaan Fiber Optic dan ADSL: Mana yang Lebih Baik?',
    slug: 'perbedaan-fiber-optic-adsl',
    excerpt: 'Kenali perbedaan mendasar antara koneksi Fiber Optic dan ADSL sebelum memutuskan berlangganan internet.',
    author_id: 1,
    status: 'published',
    published_at: '2024-03-10',
    category: 'Teknologi',
    author: { full_name: 'Tim MAZNET' },
    read_time: '7 min read'
  },
  {
    id: 3,
    title: 'Cara Mengoptimalkan Jaringan WiFi di Rumah',
    slug: 'cara-optimalkan-wifi-rumah',
    excerpt: 'Tips sederhana untuk memaksimalkan sinyal WiFi di seluruh sudut rumah Anda tanpa perlu tambahan alat mahal.',
    author_id: 2,
    status: 'published',
    published_at: '2024-03-05',
    category: 'Tutorial',
    author: { full_name: 'Teknisi MAZNET' },
    read_time: '6 min read'
  }
];

export const mockClients = [
  { id: 1, company_name: 'Perumahan Grand Wisata', industry: 'Residential', is_active: true },
  { id: 2, company_name: 'Kantor Kecamatan Bekasi Timur', industry: 'Government', is_active: true },
  { id: 3, company_name: 'SMPN 1 Bekasi', industry: 'Education', is_active: true },
  { id: 4, company_name: 'Toko Serba Ada', industry: 'Retail', is_active: true },
  { id: 5, company_name: 'Klinik Sehat Bersama', industry: 'Healthcare', is_active: true },
  { id: 6, company_name: 'Warnet Cemerlang', industry: 'Retail', is_active: true }
];

export const mockWebsiteSettings = {
  company_name: 'MAZNET',
  tagline: 'Internet Cepat, Harga Bersahabat',
  description: 'Penyedia layanan internet RT RW NET terbaik se-Kabupaten Bekasi. Jaringan fiber optik super cepat dengan harga terjangkau. Pasang baru? Hubungi kami sekarang!',
  address: 'Perumahan Grand Wisata, Kab. Bekasi',
  phone: '(021) 1234-5678',
  email: 'info@maznet.id',
  facebook_url: 'https://facebook.com/maznet.id',
  twitter_url: 'https://twitter.com/maznet_id',
  instagram_url: 'https://instagram.com/maznet.id',
  linkedin_url: 'https://linkedin.com/company/maznet'
};

export const statsData = [
  { value: '500+', label: 'Pelanggan Aktif' },
  { value: '98%', label: 'Uptime Guarantee' },
  { value: '10+', label: 'Wilayah' },
  { value: '24/7', label: 'Support' }
];