class DealershipModel {
  final String id;
  final String name;
  final String ownerName;
  final String email;
  final String phone;
  final String city;
  final String? address;
  final String? logoUrl;
  final String status;
  final DateTime createdAt;

  DealershipModel({
    required this.id,
    required this.name,
    required this.ownerName,
    required this.email,
    required this.phone,
    required this.city,
    this.address,
    this.logoUrl,
    required this.status,
    required this.createdAt,
  });

  factory DealershipModel.fromJson(Map<String, dynamic> json) {
    return DealershipModel(
      id: json['id'] as String,
      name: json['name'] as String,
      ownerName: json['owner_name'] as String,
      email: json['email'] as String,
      phone: json['phone'] as String,
      city: json['city'] as String,
      address: json['address'] as String?,
      logoUrl: json['logo_url'] as String?,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'owner_name': ownerName,
      'email': email,
      'phone': phone,
      'city': city,
      'address': address,
      'logo_url': logoUrl,
      'status': status,
    };
  }
}
