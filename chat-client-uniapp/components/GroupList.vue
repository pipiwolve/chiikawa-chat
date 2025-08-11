<template>
  <view class="group-list">
    <view
        v-for="group in groups"
        :key="group.id"
        :class="['group-item', group.id === selectedGroupId ? 'selected' : '']"
        @click="selectGroup(group.id)"
    >
      {{ group.name }}
    </view>
  </view>
</template>

<script>
export default {
  name: 'GroupList',
  props: {
    groups: {
      type: Array,
      required: true
    },
    selectedGroupId: {
      type: String,
      default: ''
    }
  },
  methods: {
    selectGroup(groupId) {
      this.$emit('select', groupId);
    }
  }
}
</script>

<style scoped>
.group-list {
  padding: 10px;
  border-top: 1px solid #eee;
  background-color: #fafafa;
}
.group-item {
  padding: 10px;
  border-bottom: 1px solid #ddd;
  font-weight: normal;
  cursor: pointer;
}
.group-item.selected {
  background-color: #007aff;
  color: white;
  font-weight: bold;
}
</style>