<template>

  <view class="contact-list">
    <view
        v-for="user in users"
        :key="user.id"
        :class="['contact-item', user.id === selectedUserId ? 'active' : '']"
        @click="$emit('select', user.id)"
    >
      {{ user.name }}
    </view>
  </view>

</template>

<script>
export default {
  props: {
    users: {
      type: Array,
      required: true
    },
    selectedUserId: {
      type: String,
      default: ''
    }
  }
}
</script>






<style>
.contact-list {
  border-bottom: 1px solid #ddd;
  display: flex;
  padding: 10px;
  background: #f9f9f9;
}
.contact-item {
  margin-right: 15px;
  padding: 5px 10px;
  border-radius: 4px;
  background: #eee;
  cursor: pointer;
}
.contact-item.active {
  background: #007AFF;
  color: white;
}
</style>