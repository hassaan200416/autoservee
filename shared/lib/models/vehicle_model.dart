class VehicleModel {
  final String id;
  final String dealershipId;
  final String make;
  final String model;
  final int year;
  final String? color;
  final int mileage;
  final double price;
  final String condition;
  final String fuelType;
  final String transmission;
  final String? bodyType;
  final String? description;
  final String status;
  final int viewsCount;
  final DateTime createdAt;
  final List<VehicleImageModel> images;

  VehicleModel({
    required this.id,
    required this.dealershipId,
    required this.make,
    required this.model,
    required this.year,
    this.color,
    required this.mileage,
    required this.price,
    required this.condition,
    required this.fuelType,
    required this.transmission,
    this.bodyType,
    this.description,
    required this.status,
    required this.viewsCount,
    required this.createdAt,
    this.images = const [],
  });

  factory VehicleModel.fromJson(Map<String, dynamic> json) {
    return VehicleModel(
      id: json['id'] as String,
      dealershipId: json['dealership_id'] as String,
      make: json['make'] as String,
      model: json['model'] as String,
      year: json['year'] as int,
      color: json['color'] as String?,
      mileage: json['mileage'] as int,
      price: (json['price'] as num).toDouble(),
      condition: json['condition'] as String,
      fuelType: json['fuel_type'] as String,
      transmission: json['transmission'] as String,
      bodyType: json['body_type'] as String?,
      description: json['description'] as String?,
      status: json['status'] as String,
      viewsCount: json['views_count'] as int? ?? 0,
      createdAt: DateTime.parse(json['created_at'] as String),
      images: json['vehicle_images'] != null
          ? (json['vehicle_images'] as List)
                .map((img) => VehicleImageModel.fromJson(img))
                .toList()
          : [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dealership_id': dealershipId,
      'make': make,
      'model': model,
      'year': year,
      'color': color,
      'mileage': mileage,
      'price': price,
      'condition': condition,
      'fuel_type': fuelType,
      'transmission': transmission,
      'body_type': bodyType,
      'description': description,
      'status': status,
    };
  }

  String get displayTitle => '$year $make $model';

  String? get primaryImageUrl {
    if (images.isEmpty) return null;
    final primary = images.where((img) => img.isPrimary).toList();
    return primary.isNotEmpty ? primary.first.imageUrl : images.first.imageUrl;
  }

  String get formattedPrice {
    return 'PKR ${price.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (match) => '${match[1]},')}';
  }
}

class VehicleImageModel {
  final String id;
  final String vehicleId;
  final String imageUrl;
  final bool isPrimary;
  final int displayOrder;

  VehicleImageModel({
    required this.id,
    required this.vehicleId,
    required this.imageUrl,
    required this.isPrimary,
    required this.displayOrder,
  });

  factory VehicleImageModel.fromJson(Map<String, dynamic> json) {
    return VehicleImageModel(
      id: json['id'] as String,
      vehicleId: json['vehicle_id'] as String,
      imageUrl: json['image_url'] as String,
      isPrimary: json['is_primary'] as bool? ?? false,
      displayOrder: json['display_order'] as int? ?? 0,
    );
  }
}
